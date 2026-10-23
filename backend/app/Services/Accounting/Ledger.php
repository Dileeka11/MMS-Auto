<?php

namespace App\Services\Accounting;

use App\Models\FinancialYear;
use App\Models\JournalEntry;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Read side of the ledger: account balances over a period, the balances a
 * year inherits from the years before it, and the financial statements.
 *
 * There are no year-end closing entries. Balance Sheet accounts simply run on
 * across years; Profit & Loss accounts are read per period, and the profit of
 * earlier years is shown in equity as retained earnings (computed).
 */
class Ledger
{
    /** Any journal entry dated before $date? */
    public static function hasHistoryBefore(string $date): bool
    {
        return JournalEntry::where('entry_date', '<', $date)->exists();
    }

    /**
     * Debit/credit totals per account (only accounts with postings), joined up
     * to group and category. $from / $to are inclusive; null = open-ended.
     */
    public static function balances(?string $from, ?string $to, ?string $statement = null): Collection
    {
        return DB::table('journal_lines as l')
            ->join('journal_entries as e', 'e.id', '=', 'l.entry_id')
            ->join('accounts as a', 'a.id', '=', 'l.account_id')
            ->join('account_groups as g', 'g.id', '=', 'a.group_id')
            ->join('account_categories as c', 'c.id', '=', 'g.category_id')
            ->when($from, fn ($q) => $q->where('e.entry_date', '>=', $from))
            ->when($to, fn ($q) => $q->where('e.entry_date', '<=', $to))
            ->when($statement, fn ($q) => $q->where('c.statement_type', $statement))
            ->groupBy('a.id', 'a.code', 'a.name', 'g.code', 'g.name', 'c.code', 'c.name', 'c.normal_balance', 'c.statement_type')
            ->orderBy('a.code')
            ->get([
                'a.id', 'a.code', 'a.name',
                'g.code as group_code', 'g.name as group_name',
                'c.code as category_code', 'c.name as category_name', 'c.normal_balance', 'c.statement_type',
                DB::raw('SUM(l.debit) as debit'), DB::raw('SUM(l.credit) as credit'),
            ]);
    }

    /** Net profit (income − expenses) for a period. */
    public static function profit(?string $from, ?string $to): float
    {
        return round(static::balances($from, $to, 'PNL')->sum(fn ($r) => (float) $r->credit - (float) $r->debit), 2);
    }

    /**
     * What a year opens with when earlier years exist: every Balance Sheet
     * account's closing balance the day before it starts, plus all earlier
     * profit folded into Retained Earnings. account id => net (debit +, credit −).
     */
    public static function carriedForward(string $start): array
    {
        $before = date('Y-m-d', strtotime($start . ' -1 day'));

        $net = [];
        foreach (static::balances(null, $before, 'BS') as $r) {
            $net[(int) $r->id] = round((float) $r->debit - (float) $r->credit, 2);
        }

        $profit = static::profit(null, $before);
        if ($profit != 0) {
            $re = Posting::accountFor('retained_earnings');
            $net[$re] = round(($net[$re] ?? 0) - $profit, 2);
        }

        return array_filter($net, fn ($v) => $v != 0);
    }

    /** Profit & Loss: Income and Expenses by group for the period. */
    public static function profitLoss(?string $from, ?string $to): array
    {
        $sections = static::sections(static::balances($from, $to, 'PNL'));
        $income = collect($sections)->where('normal_balance', 'credit')->sum('total');
        $expenses = collect($sections)->where('normal_balance', 'debit')->sum('total');

        return [
            'from' => $from,
            'to' => $to,
            'sections' => $sections,
            'total_income' => round($income, 2),
            'total_expenses' => round($expenses, 2),
            'net_profit' => round($income - $expenses, 2),
        ];
    }

    /**
     * Balance Sheet as at a date. Equity gets two computed lines: profit of
     * years before the as-at date's financial year, and profit for that year
     * up to the date. Assets must equal Liabilities + Equity.
     */
    public static function balanceSheet(string $asOf): array
    {
        $year = FinancialYear::forDate($asOf);
        $yearStart = $year ? $year->start_date->toDateString() : null;

        $sections = static::sections(static::balances(null, $asOf, 'BS'));

        $currentProfit = static::profit($yearStart, $asOf);
        $priorProfit = $yearStart ? static::profit(null, date('Y-m-d', strtotime($yearStart . ' -1 day'))) : 0.0;

        // Fold the computed profit lines into the Equity section.
        if (! in_array('3000', array_column($sections, 'category_code'), true)) {
            $sections[] = ['category_code' => '3000', 'category_name' => 'Equity', 'normal_balance' => 'credit', 'groups' => [], 'total' => 0];
            usort($sections, fn ($a, $b) => strcmp($a['category_code'], $b['category_code']));
        }
        $equityIdx = array_search('3000', array_column($sections, 'category_code'), true);
        $computed = [];
        if ($priorProfit != 0) {
            $computed[] = ['id' => null, 'code' => '', 'name' => 'Retained earnings b/f (profit of earlier years)', 'amount' => $priorProfit];
        }
        if ($currentProfit != 0) {
            $computed[] = ['id' => null, 'code' => '', 'name' => 'Profit for the period' . ($year ? " ({$year->year_name})" : ''), 'amount' => $currentProfit];
        }
        if ($computed) {
            $sections[$equityIdx]['groups'][] = [
                'code' => '', 'name' => 'Profit & Loss', 'accounts' => $computed,
                'total' => round($priorProfit + $currentProfit, 2),
            ];
            $sections[$equityIdx]['total'] = round($sections[$equityIdx]['total'] + $priorProfit + $currentProfit, 2);
        }

        $total = function ($code) use ($sections) {
            return round(collect($sections)->where('category_code', $code)->sum('total'), 2);
        };
        $assets = $total('1000');
        $liabilities = $total('2000');
        $equity = $total('3000');

        return [
            'as_of' => $asOf,
            'financial_year' => $year ? $year->year_name : null,
            'sections' => array_values($sections),
            'total_assets' => $assets,
            'total_liabilities' => $liabilities,
            'total_equity' => $equity,
            'balanced' => round($assets * 100) === round(($liabilities + $equity) * 100),
        ];
    }

    /**
     * Rows → [category → groups → accounts], each amount on the category's
     * natural side (assets/expenses = debit − credit, the rest = credit − debit).
     */
    private static function sections(Collection $rows): array
    {
        $cats = [];
        foreach ($rows as $r) {
            $amount = $r->normal_balance === 'debit'
                ? (float) $r->debit - (float) $r->credit
                : (float) $r->credit - (float) $r->debit;
            $amount = round($amount, 2);
            if ($amount == 0) {
                continue;
            }

            $c = $r->category_code;
            if (! isset($cats[$c])) {
                $cats[$c] = ['category_code' => $c, 'category_name' => $r->category_name, 'normal_balance' => $r->normal_balance, 'groups' => [], 'total' => 0];
            }
            $g = $r->group_code;
            if (! isset($cats[$c]['groups'][$g])) {
                $cats[$c]['groups'][$g] = ['code' => $g, 'name' => $r->group_name, 'accounts' => [], 'total' => 0];
            }
            $cats[$c]['groups'][$g]['accounts'][] = ['id' => (int) $r->id, 'code' => $r->code, 'name' => $r->name, 'amount' => $amount];
            $cats[$c]['groups'][$g]['total'] = round($cats[$c]['groups'][$g]['total'] + $amount, 2);
            $cats[$c]['total'] = round($cats[$c]['total'] + $amount, 2);
        }
        ksort($cats);

        return array_values(array_map(function ($cat) {
            ksort($cat['groups']);
            $cat['groups'] = array_values($cat['groups']);
            return $cat;
        }, $cats));
    }
}
