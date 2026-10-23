<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;

use App\Models\Account;
use App\Models\CashVoucher;
use App\Models\FinancialYear;
use App\Services\Accounting\Posting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Cash Book: every movement of money through the cash / bank accounts
 * (accounts flagged is_cashbook) — receipts, expenses, supplier payments,
 * deposits — with a running balance, plus the vouchers for money that
 * doesn't come from another ERP document.
 */
class CashBookController extends Controller
{
    /** Cash / bank accounts with their current book balance. */
    public function accounts()
    {
        $balances = DB::table('journal_lines')
            ->select('account_id', DB::raw('SUM(debit) - SUM(credit) as balance'))
            ->groupBy('account_id')
            ->pluck('balance', 'account_id');

        return Account::where('is_cashbook', true)->withCount('children')->orderBy('code')->get()
            ->map(function (Account $a) use ($balances) {
                return [
                    'id' => $a->id,
                    'code' => $a->code,
                    'name' => $a->name,
                    'is_active' => $a->is_active,
                    'is_postable' => $a->is_active && $a->children_count === 0,
                    'balance' => round((float) ($balances[$a->id] ?? 0), 2),
                ];
            });
    }

    /** GET /accounting/cashbook?account_id=&from=&to= — the book for one account. */
    public function index(Request $request)
    {
        $data = $request->validate([
            'account_id' => ['required', 'integer'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);
        $account = Account::where('is_cashbook', true)->find($data['account_id']);
        if (! $account) {
            return response()->json(['message' => 'Not a Cash Book account.'], 404);
        }
        $from = $data['from'] ?? null;
        $to = $data['to'] ?? null;

        $opening = $from ? (float) DB::table('journal_lines as l')
            ->join('journal_entries as e', 'e.id', '=', 'l.entry_id')
            ->where('l.account_id', $account->id)
            ->where('e.entry_date', '<', $from)
            ->sum(DB::raw('l.debit - l.credit')) : 0.0;

        $rows = DB::table('journal_lines as l')
            ->join('journal_entries as e', 'e.id', '=', 'l.entry_id')
            ->where('l.account_id', $account->id)
            ->when($from, fn ($q) => $q->where('e.entry_date', '>=', $from))
            ->when($to, fn ($q) => $q->where('e.entry_date', '<=', $to))
            ->orderBy('e.entry_date')->orderBy('e.id')->orderBy('l.id')
            ->get(['e.id as entry_id', 'e.entry_date', 'e.reference', 'e.source_type', 'e.source_id', 'e.memo', 'l.debit', 'l.credit', 'l.memo as line_memo']);

        // The other side(s) of each entry — what the money was for / from.
        $counters = DB::table('journal_lines as l')
            ->join('accounts as a', 'a.id', '=', 'l.account_id')
            ->whereIn('l.entry_id', $rows->pluck('entry_id')->unique())
            ->where('l.account_id', '!=', $account->id)
            ->get(['l.entry_id', 'a.code', 'a.name'])
            ->groupBy('entry_id')
            ->map(fn ($ls) => $ls->map(fn ($x) => "{$x->code} · {$x->name}")->unique()->implode(', '));

        $balance = $opening;
        $in = 0.0;
        $out = 0.0;
        $lines = [];
        foreach ($rows as $r) {
            $debit = (float) $r->debit;
            $credit = (float) $r->credit;
            $balance += $debit - $credit;
            $in += $debit;
            $out += $credit;
            $lines[] = [
                'entry_id' => (int) $r->entry_id,
                'date' => $r->entry_date,
                'reference' => $r->reference,
                'source' => Posting::SOURCE_LABELS[$r->source_type] ?? 'Manual',
                'source_type' => $r->source_type,
                'source_id' => $r->source_id === null ? null : (int) $r->source_id,
                'particulars' => $r->memo,
                'detail' => $r->line_memo,
                'counter_accounts' => $counters[$r->entry_id] ?? '',
                'receipt' => round($debit, 2),
                'payment' => round($credit, 2),
                'balance' => round($balance, 2),
            ];
        }

        return response()->json([
            'account' => ['id' => $account->id, 'code' => $account->code, 'name' => $account->name],
            'from' => $from,
            'to' => $to,
            'opening_balance' => round($opening, 2),
            'lines' => $lines,
            'total_receipts' => round($in, 2),
            'total_payments' => round($out, 2),
            'closing_balance' => round($balance, 2),
        ]);
    }

    /** GET /accounting/cash-vouchers — latest vouchers. */
    public function vouchers(Request $request)
    {
        $data = $request->validate(['type' => ['nullable', 'in:receipt,payment,transfer']]);

        return CashVoucher::with(['account:id,code,name', 'counterAccount:id,code,name'])
            ->when($data['type'] ?? null, fn ($q, $t) => $q->where('type', $t))
            ->orderByDesc('date')->orderByDesc('id')
            ->limit(500)
            ->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'type' => ['required', 'in:receipt,payment,transfer'],
            'date' => ['required', 'date'],
            'account_id' => ['required', 'integer', 'exists:accounts,id'],
            'counter_account_id' => ['required', 'integer', 'exists:accounts,id', 'different:account_id'],
            'amount' => ['required', 'numeric', 'gt:0', 'max:999999999'],
            'party' => ['nullable', 'string', 'max:150'],
            'supplier' => ['nullable', 'string', 'max:150'],
            'reference' => ['nullable', 'string', 'max:60'],
            'memo' => ['nullable', 'string', 'max:255'],
        ]);

        $accounts = Account::whereIn('id', [$data['account_id'], $data['counter_account_id']])->get()->keyBy('id');
        $cash = $accounts[$data['account_id']];
        $other = $accounts[$data['counter_account_id']];
        if (! $cash->is_cashbook) {
            throw ValidationException::withMessages(['account_id' => "{$cash->code} · {$cash->name} is not a cash / bank account."]);
        }
        foreach ([$cash, $other] as $a) {
            if (! Posting::isPostable($a)) {
                throw ValidationException::withMessages(['account_id' => "{$a->code} · {$a->name} is inactive or a header account."]);
            }
        }
        if ($data['type'] === 'transfer' && ! $other->is_cashbook) {
            throw ValidationException::withMessages(['counter_account_id' => 'A transfer goes to another cash / bank account.']);
        }
        if ($data['type'] !== 'transfer' && $other->is_cashbook) {
            throw ValidationException::withMessages(['counter_account_id' => 'Money moving between cash and bank accounts is a Transfer.']);
        }
        if (! FinancialYear::forDate($data['date'])) {
            throw ValidationException::withMessages(['date' => 'The date is not inside any financial year.']);
        }

        $voucher = DB::transaction(function () use ($data, $request) {
            $voucher = CashVoucher::create($data + [
                'code' => CashVoucher::nextCode($data['type']),
                'created_by' => optional($request->user())->name,
            ]);
            Posting::cashVoucher($voucher);

            return $voucher;
        });

        return response()->json($voucher->load(['account:id,code,name', 'counterAccount:id,code,name']), 201);
    }

    public function destroy(CashVoucher $cashVoucher)
    {
        DB::transaction(function () use ($cashVoucher) {
            Posting::remove(Posting::CASH_VOUCHER, $cashVoucher->id);
            $cashVoucher->delete();
        });

        return response()->json(['message' => 'Deleted.']);
    }

    /**
     * Supplier balances: value received on GRNs less Cash Book payments made
     * to them — for the supplier-payment form.
     */
    public function suppliers()
    {
        $received = DB::table('grns')->select('supplier', DB::raw('SUM(total) as total'))->groupBy('supplier')->pluck('total', 'supplier');
        $paid = CashVoucher::where('type', 'payment')->whereNotNull('supplier')
            ->select('supplier', DB::raw('SUM(amount) as total'))->groupBy('supplier')->pluck('total', 'supplier');

        return collect(DB::table('suppliers')->orderBy('name')->pluck('name'))
            ->merge($received->keys())->merge($paid->keys())->unique()->values()
            ->map(function ($name) use ($received, $paid) {
                $r = round((float) ($received[$name] ?? 0), 2);
                $p = round((float) ($paid[$name] ?? 0), 2);
                return ['name' => $name, 'received' => $r, 'paid' => $p, 'balance' => round($r - $p, 2)];
            });
    }
}
