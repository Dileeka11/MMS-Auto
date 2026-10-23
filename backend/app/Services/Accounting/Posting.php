<?php

namespace App\Services\Accounting;

use App\Models\Account;
use App\Models\AccountMapping;
use App\Models\CashVoucher;
use App\Models\Expense;
use App\Models\FinancialYear;
use App\Models\Grn;
use App\Models\Invoice;
use App\Models\Item;
use App\Models\JournalEntry;
use App\Models\JournalLine;
use App\Models\Master;
use App\Models\OpeningBalance;
use App\Models\Receipt;
use App\Models\SalesReturn;
use App\Models\StockAdjustment;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Auto-posting: turns ERP documents into balanced journal entries.
 *
 * Every document owns at most one journal entry (journal_entries has a unique
 * source_type + source_id). Posting is a "sync": the document's current state
 * replaces whatever was posted for it before, so calling it again after an
 * edit / approval re-posts it, and remove() drops it when the document goes.
 * Callers run inside the document's DB transaction, so a posting failure
 * (e.g. a mapped account was deactivated) rolls the document back too —
 * the books never drift from the operational data.
 *
 * Legs are [role key | account id, signed amount, memo?] — positive = debit,
 * negative = credit. Zero legs are dropped.
 */
class Posting
{
    public const INVOICE = 'invoice';
    public const RECEIPT = 'receipt';
    public const EXPENSE = 'expense';
    public const GRN = 'grn';
    public const SALES_RETURN = 'sales_return';
    public const STOCK_ADJUSTMENT = 'stock_adjustment';
    public const OPENING_BALANCE = 'opening_balance';
    public const CASH_VOUCHER = 'cash_voucher';

    /** Posting roles: key => [label, default account code, where it is used]. */
    public const ROLES = [
        'cash' => ['Cash', '110000', 'Cash receipts (Dr) · expenses paid (Cr)'],
        'bank' => ['Bank', '110100', 'Cheque / bank transfer / card receipts (Dr)'],
        'receivable' => ['Trade Receivable', '110200', 'Sales invoices (Dr) · receipts & returns (Cr)'],
        'inventory' => ['Inventory', '110300', 'GRN (Dr) · cost of invoices sold (Cr) · stock adjustments'],
        'vat_input' => ['VAT Input (Recoverable)', '110400', 'VAT portion of GRN landed cost (Dr)'],
        'payable' => ['Trade Payable', '210000', 'GRN value incl. VAT (Cr)'],
        'vat_output' => ['VAT Output (Payable)', '210100', 'VAT charged on sales invoices (Cr)'],
        'sales' => ['Sales Revenue', '410000', 'Invoice value of supply before discount (Cr)'],
        'sales_returns' => ['Sales Returns', '410100', 'Approved sales returns (Dr)'],
        'cogs' => ['Cost of Sales', '510000', 'Cost of invoiced items, FIFO / Average per line (Dr)'],
        'stock_adjustment' => ['Stock Adjustment (Gain)/Loss', '510100', 'Stock adjustment value at avg cost'],
        'discount' => ['Discount Given', '520000', 'Approved invoice discounts (Dr)'],
        'expense' => ['Default Expense', '5009', 'Expenses whose type has no valid GL account'],
        'retained_earnings' => ['Retained Earnings', '3002', "Prior years' profit carried into the next year's opening balances and the Balance Sheet"],
    ];

    /** Human labels for source_type, shown on journal lists. */
    public const SOURCE_LABELS = [
        self::INVOICE => 'Sales Invoice',
        self::RECEIPT => 'Payment Receipt',
        self::EXPENSE => 'Expense',
        self::GRN => 'GRN',
        self::SALES_RETURN => 'Sales Return',
        self::STOCK_ADJUSTMENT => 'Stock Adjustment',
        self::OPENING_BALANCE => 'Opening Balance',
        self::CASH_VOUCHER => 'Cash Book',
    ];

    /** Resolved role -> account id, per request. */
    private static $cache = [];

    public static function flush(): void
    {
        static::$cache = [];
    }

    /* ------------------------------------------------------------------
       Document rules
       ------------------------------------------------------------------ */

    /**
     * Sales invoice: Dr Receivable (total) / Cr Sales (gross) / Cr VAT Output,
     * Dr Discount for any approved discount, and Dr COGS / Cr Inventory at the
     * cost of each line's costing method.
     */
    public static function invoice(Invoice $invoice): void
    {
        $invoice->load('lines');

        $gross = 0.0;
        $cost = 0.0;
        foreach ($invoice->lines as $l) {
            $gross += $l->qty * (float) $l->rate;
            $cost += $l->qty * (float) ($l->method === 'Average' ? $l->avg_cost : $l->fifo_cost);
        }
        $vat = round((float) $invoice->vat_amount, 2);
        $total = round((float) $invoice->total, 2);
        // An invoice without lines (imported / legacy) books its total as sales.
        $gross = $invoice->lines->isEmpty() ? $total - $vat : round($gross, 2);

        static::post(self::INVOICE, $invoice->id, [
            'entry_date' => static::day($invoice->date),
            'reference' => $invoice->code,
            'memo' => "Sales invoice {$invoice->code} · {$invoice->customer}",
            'invoice_number' => $invoice->code,
            'customer_name' => $invoice->customer,
        ], [
            ['receivable', $total, $invoice->customer],
            ['discount', $gross + $vat - $total, $invoice->discount_pct > 0 ? "Discount {$invoice->discount_pct}%" : null],
            ['sales', -$gross],
            ['vat_output', -$vat, $vat ? "VAT {$invoice->vat_pct}%" : null],
            ['cogs', $cost, 'Cost of goods sold'],
            ['inventory', -$cost, 'Cost of goods sold'],
        ]);
    }

    /** Customer receipt: Dr Cash or Bank (by mode) / Cr Receivable. */
    public static function receipt(Receipt $receipt): void
    {
        $cash = strcasecmp(trim((string) $receipt->mode), 'Cash') === 0;
        $amount = (float) $receipt->amount;
        // A receipt may name the exact cash / bank account it went into.
        $into = $receipt->account_id ? static::checkAccount((int) $receipt->account_id) : static::accountFor($cash ? 'cash' : 'bank');

        static::post(self::RECEIPT, $receipt->id, [
            'entry_date' => static::day($receipt->date),
            'reference' => $receipt->code,
            'memo' => "Receipt {$receipt->code} · {$receipt->customer} · against {$receipt->against}",
            'invoice_number' => $receipt->against,
            'customer_name' => $receipt->customer,
            'payment_method' => $cash ? 'cash_in_hand' : 'bank',
            'payment_account_id' => $into,
        ], [
            [$into, $amount, $receipt->mode . ($receipt->cheque_no ? " #{$receipt->cheque_no}" : '')],
            ['receivable', -$amount, $receipt->customer],
        ]);
    }

    /**
     * Expense paid in cash: Dr the expense type's GL account (Master Files →
     * Expense Type → GL Account, matched by account code) / Cr Cash. Falls back
     * to the default expense account when the type has no usable account.
     */
    public static function expense(Expense $expense): void
    {
        $amount = (float) $expense->amount;
        $type = Master::type('expenseType')->where('name', $expense->type)->first();
        $code = $type ? trim((string) ($type->data['account'] ?? '')) : '';
        $account = $code !== '' ? Account::where('code', $code)->first() : null;
        $debit = $account && static::isPostable($account) ? $account->id : 'expense';
        // Paid from a chosen cash / bank account, else the Cash role.
        $from = $expense->payment_account_id ? static::checkAccount((int) $expense->payment_account_id) : static::accountFor('cash');

        static::post(self::EXPENSE, $expense->id, [
            'entry_date' => static::day($expense->date),
            'reference' => $expense->code,
            'branch' => $expense->branch,
            'memo' => "Expense {$expense->code} · {$expense->type}" . ($expense->note ? " · {$expense->note}" : ''),
            'payment_method' => $from === static::accountFor('cash') ? 'cash_in_hand' : 'bank',
            'payment_account_id' => $from,
        ], [
            [$debit, $amount, $expense->type],
            [$from, -$amount],
        ]);
    }

    /**
     * Cash Book voucher. Receipt: Dr cash/bank / Cr the other account.
     * Payment: Dr the other account / Cr cash/bank. Transfer: Dr the "to"
     * cash/bank account / Cr the "from" one.
     */
    public static function cashVoucher(CashVoucher $v): void
    {
        $amount = (float) $v->amount;
        $in = $v->type === 'receipt';
        $label = ['receipt' => 'Cash receipt', 'payment' => 'Cash payment', 'transfer' => 'Transfer'][$v->type] ?? 'Cash voucher';
        $who = $v->supplier ?: $v->party;

        static::post(self::CASH_VOUCHER, $v->id, [
            'entry_date' => static::day($v->date),
            'reference' => $v->code,
            'memo' => trim("{$label} {$v->code}" . ($who ? " · {$who}" : '') . ($v->memo ? " · {$v->memo}" : '')),
            'customer_name' => $v->party,
            'payment_method' => $v->account_id === static::roleAccountIds()['cash'] ? 'cash_in_hand' : 'bank',
            'payment_account_id' => $v->account_id,
        ], [
            [static::checkAccount($v->account_id), $in ? $amount : -$amount, $v->reference],
            [static::checkAccount($v->counter_account_id), $in ? -$amount : $amount, $who],
        ]);
    }

    /**
     * GRN (stock received at landed cost): Dr Inventory (ex-VAT) / Dr VAT Input
     * (the VAT portion) / Cr Trade Payable (incl. VAT).
     */
    public static function grn(Grn $grn): void
    {
        $grn->load('lines');

        $stock = 0.0;
        foreach ($grn->lines as $l) {
            // Older GRN lines have no ex-VAT cost (0) — fall back to the line cost.
            $unit = (float) $l->unit_cost_wo_vat > 0 ? (float) $l->unit_cost_wo_vat : (float) $l->cost;
            $stock += $l->qty * $unit;
        }
        $stock = round($stock, 2);
        $total = round((float) $grn->total, 2);

        static::post(self::GRN, $grn->id, [
            'entry_date' => static::day($grn->date),
            'reference' => $grn->code,
            'memo' => "GRN {$grn->code} · {$grn->supplier} · PO {$grn->po}",
        ], [
            ['inventory', $stock, "Stock received ({$grn->items} lines)"],
            ['vat_input', $total - $stock, 'VAT on landed cost'],
            ['payable', -$total, $grn->supplier],
        ]);
    }

    /** Approved sales return: Dr Sales Returns / Cr Receivable. Anything else is unposted. */
    public static function salesReturn(SalesReturn $return): void
    {
        if ($return->status !== 'Approved') {
            static::remove(self::SALES_RETURN, $return->id);
            return;
        }
        $return->load('lines');
        $amount = round((float) $return->amount, 2);
        $vat = round((float) $return->vat_amount, 2);
        // Goods that came back go into stock at the cost they were sold at.
        $cost = $return->restocked
            ? $return->lines->sum(function ($l) { return $l->qty * (float) $l->unit_cost; })
            : 0;

        static::post(self::SALES_RETURN, $return->id, [
            'entry_date' => static::day($return->date),
            'reference' => $return->code,
            'memo' => "Sales return {$return->code} · {$return->customer} · invoice {$return->invoice}",
            'invoice_number' => $return->invoice,
            'customer_name' => $return->customer,
        ], [
            ['sales_returns', $amount - $vat, $return->reason],
            ['vat_output', $vat, $vat ? 'VAT reversed' : null],
            ['receivable', -$amount, $return->customer],
            ['inventory', $cost, 'Returned stock'],
            ['cogs', -$cost, 'Returned stock'],
        ]);
    }

    /**
     * Stock adjustment valued at the item's avg cost (frozen on the adjustment):
     * Increase = Dr Inventory / Cr Adjustment; Decrease = the reverse.
     */
    public static function stockAdjustment(StockAdjustment $adj): void
    {
        if ($adj->unit_cost === null) {
            $item = $adj->item_code ? Item::where('code', $adj->item_code)->first() : null;
            $adj->unit_cost = $item ? (float) $item->avg_cost : 0;
            $adj->save();
        }
        $value = $adj->qty * (float) $adj->unit_cost;
        if ($adj->type === 'Decrease') {
            $value = -$value;
        }

        static::post(self::STOCK_ADJUSTMENT, $adj->id, [
            'entry_date' => static::day($adj->date),
            'reference' => $adj->code,
            'memo' => "Stock adjustment {$adj->code} · {$adj->item} · {$adj->type} {$adj->qty}" . ($adj->reason ? " · {$adj->reason}" : ''),
        ], [
            ['inventory', $value, $adj->item],
            ['stock_adjustment', -$value, $adj->reason],
        ]);
    }

    /** A financial year's opening balances as one journal dated on its start date. */
    public static function openingBalances(FinancialYear $year): void
    {
        $rows = OpeningBalance::where('financial_year_id', $year->id)->get();
        // Once the ledger has history before this year, its balances carry
        // forward on their own — a second set of opening balances would count twice.
        if ($rows->isNotEmpty() && Ledger::hasHistoryBefore(static::day($year->start_date))) {
            throw ValidationException::withMessages([
                'balances' => "{$year->year_name} already has balances carried forward from earlier entries — opening balances can only be entered for the first year.",
            ]);
        }

        $legs = $rows
            ->map(function (OpeningBalance $ob) {
                return [(int) $ob->account_id, (float) $ob->debit - (float) $ob->credit];
            })
            ->all();

        static::post(self::OPENING_BALANCE, $year->id, [
            'entry_date' => static::day($year->start_date),
            'reference' => 'OB ' . $year->year_name,
            'memo' => "Opening balances · {$year->year_name}",
        ], $legs);
    }

    /**
     * Re-post every document (backfill after install, or after changing the
     * posting setup). One failing document doesn't stop the rest.
     */
    public static function rebuild(): array
    {
        static::flush();
        $sets = [
            self::INVOICE => [Invoice::query(), 'invoice'],
            self::RECEIPT => [Receipt::query(), 'receipt'],
            self::EXPENSE => [Expense::query(), 'expense'],
            self::GRN => [Grn::query(), 'grn'],
            self::SALES_RETURN => [SalesReturn::query(), 'salesReturn'],
            self::STOCK_ADJUSTMENT => [StockAdjustment::query(), 'stockAdjustment'],
            self::OPENING_BALANCE => [FinancialYear::query(), 'openingBalances'],
            self::CASH_VOUCHER => [CashVoucher::query(), 'cashVoucher'],
        ];

        $posted = [];
        $errors = [];
        foreach ($sets as $type => [$query, $method]) {
            $posted[$type] = 0;
            $query->orderBy('id')->chunkById(200, function ($docs) use ($type, $method, &$posted, &$errors) {
                foreach ($docs as $doc) {
                    try {
                        DB::transaction(function () use ($method, $doc) {
                            static::$method($doc);
                        });
                        $posted[$type]++;
                    } catch (\Throwable $e) {
                        $msg = $e instanceof ValidationException ? collect($e->errors())->flatten()->first() : $e->getMessage();
                        $errors[] = (static::SOURCE_LABELS[$type] ?? $type) . ' ' . ($doc->code ?? $doc->year_name ?? $doc->id) . ': ' . $msg;
                    }
                }
            });
        }

        // Journals whose document no longer exists (deleted before auto-posting
        // tracked deletes) are dropped so the ledger mirrors the documents.
        $orphans = 0;
        $tables = [
            self::INVOICE => 'invoices', self::RECEIPT => 'receipts', self::EXPENSE => 'expenses',
            self::GRN => 'grns', self::SALES_RETURN => 'sales_returns',
            self::STOCK_ADJUSTMENT => 'stock_adjustments', self::OPENING_BALANCE => 'financial_years',
            self::CASH_VOUCHER => 'cash_vouchers',
        ];
        foreach ($tables as $type => $table) {
            $ids = JournalEntry::where('source_type', $type)
                ->whereNotIn('source_id', DB::table($table)->select('id'))
                ->pluck('source_id');
            foreach ($ids as $id) {
                static::remove($type, $id);
                $orphans++;
            }
        }

        return ['posted' => $posted, 'removed' => $orphans, 'errors' => $errors];
    }

    /* ------------------------------------------------------------------
       Engine
       ------------------------------------------------------------------ */

    /** Replace the journal for a document with a freshly built one. */
    protected static function post(string $type, int $id, array $header, array $legs): void
    {
        $lines = [];
        $net = 0;
        foreach ($legs as $leg) {
            $cents = (int) round($leg[1] * 100);
            if ($cents === 0) {
                continue;
            }
            $accountId = is_int($leg[0]) ? static::checkAccount($leg[0]) : static::accountFor($leg[0]);
            $net += $cents;
            $lines[] = [
                'account_id' => $accountId,
                'debit' => $cents > 0 ? $cents / 100 : 0,
                'credit' => $cents < 0 ? -$cents / 100 : 0,
                'memo' => isset($leg[2]) ? mb_substr((string) $leg[2], 0, 255) : null,
            ];
        }

        if ($net !== 0) {
            throw ValidationException::withMessages([
                'journal' => sprintf('Journal for %s is not balanced (difference %.2f).', $header['reference'] ?? $type, $net / 100),
            ]);
        }

        DB::transaction(function () use ($type, $id, $header, $lines) {
            static::remove($type, $id);
            if (! $lines) {
                return;
            }

            $entry = JournalEntry::create(array_merge([
                'posting_date' => $header['entry_date'],
                'currency' => 'LKR',
                'financial_year_id' => optional(FinancialYear::forDate($header['entry_date']))->id,
            ], $header, [
                'memo' => isset($header['memo']) ? mb_substr($header['memo'], 0, 255) : null,
                'source_type' => $type,
                'source_id' => $id,
            ]));

            foreach ($lines as $line) {
                JournalLine::create(['entry_id' => $entry->id] + $line);
            }
        });
    }

    /** Drop the journal posted for a document (if any). */
    public static function remove(string $type, int $id): void
    {
        $ids = JournalEntry::where('source_type', $type)->where('source_id', $id)->pluck('id');
        if ($ids->isNotEmpty()) {
            JournalLine::whereIn('entry_id', $ids)->delete();
            JournalEntry::whereIn('id', $ids)->delete();
        }
    }

    /** The account a posting role uses: the mapping, else the role's default code. */
    public static function accountFor(string $role): int
    {
        if (isset(static::$cache[$role])) {
            return static::$cache[$role];
        }
        if (! isset(static::ROLES[$role])) {
            throw new \InvalidArgumentException("Unknown posting role {$role}.");
        }

        $mapped = AccountMapping::where('key', $role)->value('account_id');
        $account = $mapped
            ? Account::find($mapped)
            : Account::where('code', static::ROLES[$role][1])->first();

        $label = static::ROLES[$role][0];
        if (! $account) {
            throw ValidationException::withMessages([
                'journal' => "No ledger account is set for \"{$label}\". Set it in Accounting → Posting Setup.",
            ]);
        }
        if (! static::isPostable($account)) {
            throw ValidationException::withMessages([
                'journal' => "The \"{$label}\" posting account ({$account->code} · {$account->name}) is inactive or a header account. Fix it in Accounting → Posting Setup.",
            ]);
        }

        return static::$cache[$role] = $account->id;
    }

    /** Effective account id per role (mapping, else default code); null = unresolved. No validation. */
    public static function roleAccountIds(): array
    {
        $mapped = AccountMapping::whereNotNull('account_id')->pluck('account_id', 'key');
        $byCode = Account::whereIn('code', collect(static::ROLES)->pluck(1))->pluck('id', 'code');

        $ids = [];
        foreach (static::ROLES as $key => $role) {
            $id = $mapped[$key] ?? $byCode[$role[1]] ?? null;
            $ids[$key] = $id === null ? null : (int) $id;
        }

        return $ids;
    }

    /** Leaf (no sub-accounts) and active — the only accounts journals may hit. */
    public static function isPostable(Account $account): bool
    {
        return $account->is_active && ! $account->children()->exists();
    }

    private static function checkAccount(int $id): int
    {
        $account = Account::find($id);
        if (! $account || ! static::isPostable($account)) {
            throw ValidationException::withMessages([
                'journal' => 'Account ' . ($account ? "{$account->code} · {$account->name}" : "#{$id}") . ' is missing, inactive or a header account.',
            ]);
        }

        return $id;
    }

    private static function day($value): string
    {
        if ($value instanceof \DateTimeInterface) {
            return $value->format('Y-m-d');
        }

        return $value ? substr((string) $value, 0, 10) : now()->toDateString();
    }
}
