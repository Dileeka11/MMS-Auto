<?php

namespace App\Services\Accounting;

use App\Models\Master;
use Illuminate\Support\Facades\DB;

/**
 * The NMS Auto cost-code chart (database/data/nms_cost_codes.php, from the
 * client's "Cost Code - Rev A" sheet): the sheet's Account Types become the
 * account groups and its cost codes (R1000, R1000:R1100, …) the accounts.
 *
 * install() is idempotent. On a database that still has the old numeric chart
 * (110000 Cash, 410000 Sales Revenue, …) it re-codes those rows in place, so
 * journal lines, receipts, vouchers and posting mappings keep pointing at the
 * same account ids. Two old accounts that land on one cost code are merged.
 * Old seeded accounts with no cost-code equivalent are deleted when nothing
 * references them (deactivated otherwise) and emptied old groups removed.
 *
 * database/sql/nms_cost_codes_live.sql does the same for the live host.
 */
class CostCodes
{
    /** Old chart code => cost code. Order matters: the first claims the code, later ones merge into it. */
    public const LEGACY = [
        '110000' => 'A3140', // Cash                    → Cash In Hand
        '1001' => 'A3121',   // HNB Bank Account        → HNB Bank Account (under Bank Current AC)
        '110100' => 'A3121', // Bank                    → merged into HNB Bank Account
        '110200' => 'A3210', // Trade Receivable
        '110300' => 'A3810', // Inventory               → Stock: Finish Good
        '110400' => 'A3543', // VAT Input               → VAT Receivable from CGIR
        '210000' => 'L4140', // Trade Payable           → Import related Exp. (foreign suppliers)
        '2001' => 'L4140',   // Accounts Payable        → merged
        '210100' => 'L4610', // VAT Output              → VAT payable to CGIR
        '410000' => 'R1100', // Sales Revenue           → Sales Income
        '410100' => 'R1200', // Sales Returns           → Sales Return
        '520000' => 'R1400', // Cash Discount Given     → Trade Discount
        '510000' => 'E3110', // Cost of Sales           → COGS: Finish Good
        '510100' => 'E3320', // Stock Adjustment        → Damages & Losses
        '5009' => 'E4520',   // Administrative Expenses → Other Admin Exp
        '3002' => 'L7000',   // Retained Earnings       → Retain Earning
        '1004' => 'A3511',   // Prepayments             → Advanced Payment
        '1005' => 'A1140',   // Fixed Assets            → Other fixed Assets
        '2004' => 'L5210',   // Loans                   → Other Long term Loan
        '2005' => 'L4650',   // Tax Payable             → Income Tax
        '4002' => 'R2100',   // Other Income            → Sundry
        '5002' => 'E4360',   // Office Stationery       → Office Supplies
        '5003' => 'E4400',   // IT Equipment            → IT related hardware
        '5005' => 'E4120',   // Salaries
        '5006' => 'E4320',   // Rent                    → Housing Rent
        '5007' => 'E4300',   // Utilities               → Electricity
        '5008' => 'E7500',   // Finance Costs           → Other Finance Exp
        '5010' => 'E5390',   // Selling & Distribution  → Other S&D Exp
    ];

    /** Cash Book runs on these. */
    public const CASHBOOK = ['A3110', 'A3121', 'A3130', 'A3140'];

    /** Tables/columns holding an accounts.id (no DB-level FKs on this host). */
    private const REFS = [
        ['journal_lines', 'account_id'],
        ['journal_entries', 'payment_account_id'],
        ['account_mappings', 'account_id'],
        ['cash_vouchers', 'account_id'],
        ['cash_vouchers', 'counter_account_id'],
        ['expenses', 'payment_account_id'],
        ['receipts', 'account_id'],
    ];

    public static function data(): array
    {
        return require database_path('data/nms_cost_codes.php');
    }

    public static function install(): void
    {
        $data = static::data();
        $now = now();

        DB::transaction(function () use ($data, $now) {
            // 1. Groups — the sheet's Account Types.
            $categoryId = DB::table('account_categories')->pluck('id', 'code');
            foreach ($data['groups'] as [$code, $name, $category]) {
                $values = ['name' => $name, 'category_id' => $categoryId[$category], 'updated_at' => $now];
                if (DB::table('account_groups')->where('code', $code)->exists()) {
                    DB::table('account_groups')->where('code', $code)->update($values);
                } else {
                    DB::table('account_groups')->insert($values + ['code' => $code, 'created_at' => $now]);
                }
            }
            $groupId = DB::table('account_groups')->pluck('id', 'code');

            // 2. Old chart → cost codes (re-code in place, or merge).
            $renamed = [];
            foreach (self::LEGACY as $old => $new) {
                $from = DB::table('accounts')->where('code', $old)->first();
                if (! $from) {
                    continue;
                }
                $into = DB::table('accounts')->where('code', $new)->first();
                if (! $into) {
                    DB::table('accounts')->where('id', $from->id)->update(['code' => $new]);
                } else {
                    static::merge($from->id, $into->id);
                }
                $renamed[$old] = $new;
            }

            // 3. Upsert the chart (parents come first in the data).
            foreach ($data['accounts'] as [$code, $parent, $group, $name, $description]) {
                $values = [
                    'group_id' => $groupId[$group],
                    'parent_id' => $parent ? DB::table('accounts')->where('code', $parent)->value('id') : null,
                    'name' => $name,
                    'description' => $description,
                    'is_default' => true,
                    'created_by' => 'system',
                    'updated_at' => $now,
                ];
                if (DB::table('accounts')->where('code', $code)->exists()) {
                    DB::table('accounts')->where('code', $code)->update($values);
                } else {
                    DB::table('accounts')->insert($values + ['code' => $code, 'is_active' => true, 'created_at' => $now]);
                }
            }
            DB::table('accounts')->whereIn('code', self::CASHBOOK)->update(['is_cashbook' => true]);

            // 4. Old seeded accounts with no cost code: drop if unused, else retire.
            $chart = array_column($data['accounts'], 0);
            $leftovers = DB::table('accounts')->where('created_by', 'system')->whereNotIn('code', $chart)->get();
            foreach ($leftovers as $a) {
                if (static::referenced($a->id)) {
                    DB::table('accounts')->where('id', $a->id)->update(['is_active' => false, 'is_cashbook' => false, 'is_default' => false]);
                } else {
                    DB::table('accounts')->where('id', $a->id)->delete();
                }
            }
            $chartGroups = array_column($data['groups'], 0);
            DB::table('account_groups')->whereNotIn('code', $chartGroups)
                ->whereNotExists(function ($q) {
                    $q->select(DB::raw(1))->from('accounts')->whereColumn('accounts.group_id', 'account_groups.id');
                })->delete();

            // 5. Expense types point at a GL account by code.
            if ($renamed) {
                foreach (Master::type('expenseType')->get() as $type) {
                    $d = $type->data ?: [];
                    $code = trim((string) ($d['account'] ?? ''));
                    if (isset($renamed[$code])) {
                        $d['account'] = $renamed[$code];
                        $type->data = $d;
                        $type->save();
                    }
                }
            }
        });

        Posting::flush();
    }

    /** Move everything that points at $fromId onto $intoId, then delete $fromId. */
    private static function merge(int $fromId, int $intoId): void
    {
        foreach (self::REFS as [$table, $column]) {
            DB::table($table)->where($column, $fromId)->update([$column => $intoId]);
        }
        DB::table('accounts')->where('parent_id', $fromId)->update(['parent_id' => $intoId]);

        // Opening balances: one row per account per year — net into the keeper's.
        foreach (DB::table('opening_balances')->where('account_id', $fromId)->get() as $ob) {
            $mine = DB::table('opening_balances')
                ->where('financial_year_id', $ob->financial_year_id)
                ->where('account_id', $intoId)
                ->first();
            if (! $mine) {
                DB::table('opening_balances')->where('id', $ob->id)->update(['account_id' => $intoId]);
                continue;
            }
            $net = round(($mine->debit - $mine->credit) + ($ob->debit - $ob->credit), 2);
            DB::table('opening_balances')->where('id', $mine->id)->update(['debit' => max(0, $net), 'credit' => max(0, -$net)]);
            DB::table('opening_balances')->where('id', $ob->id)->delete();
        }

        $from = DB::table('accounts')->where('id', $fromId)->first();
        if ($from && $from->is_cashbook) {
            DB::table('accounts')->where('id', $intoId)->update(['is_cashbook' => true]);
        }
        DB::table('accounts')->where('id', $fromId)->delete();
    }

    private static function referenced(int $id): bool
    {
        foreach (self::REFS as [$table, $column]) {
            if (DB::table($table)->where($column, $id)->exists()) {
                return true;
            }
        }

        return DB::table('opening_balances')->where('account_id', $id)->exists()
            || DB::table('accounts')->where('parent_id', $id)->exists();
    }
}
