<?php

namespace App\Services\Accounting;

use App\Models\Master;
use Illuminate\Support\Facades\DB;

/**
 * Master Files → Expense Type, loaded from the "E" cost codes of the NMS Auto
 * chart (database/data/nms_cost_codes.php). One expense type per postable
 * E-account: code = the cost code (E4120), GL Account = the same code, so
 * Posting::expense() debits exactly that account.
 *
 * Header accounts (E3000, E4000 …) are skipped because they only group other
 * accounts. So are the accounts the system posts to by itself (COGS, stock
 * adjustment). Expenses are matched to their type by name, so names that
 * appear twice in the chart get the section added, e.g.
 * "Staff Training (Admin)" / "Staff Training (S&D)".
 *
 * install() is idempotent. It adds missing types and leaves existing ones
 * alone, so renames or deactivations made in Master Files are kept. Older
 * types whose GL account isn't in the chart (the demo Fuel / Salary / Rent …
 * set) are marked Inactive. They are not deleted, so past expenses keep
 * their type.
 *
 * Live host: database/sql/expense_types_live.sql (same rows).
 */
class ExpenseTypes
{
    /** Posted automatically — not for manual expenses. */
    public const SYSTEM = ['E3110', 'E3320'];

    /** Section label per header account, used only to tell duplicate names apart. */
    public const SECTIONS = [
        'E3000' => 'Cost of Sales',
        'E4000' => 'Admin',
        'E5000' => 'S&D',
        'E6000' => 'Depreciation',
        'E7000' => 'Finance',
        'E8000' => 'Tax',
    ];

    /**
     * [code, name, description] for every expense type to install.
     * Pure: works from the cost-code data only.
     */
    public static function rows(array $accounts): array
    {
        $parents = array_flip(array_filter(array_column($accounts, 1)));
        $leaves = [];
        foreach ($accounts as [$code, $parent, , $name, $description]) {
            if ($code[0] !== 'E' || isset($parents[$code]) || in_array($code, self::SYSTEM, true)) {
                continue;
            }
            $leaves[] = [$code, $parent, trim($name), trim((string) $description)];
        }

        $count = static function (array $names) {
            return array_count_values(array_map('strtolower', $names));
        };

        // Pass 1: bare name. Pass 2: + section. Pass 3: + cost code.
        $names = array_column($leaves, 2);
        $dupes = $count($names);
        foreach ($leaves as $i => [$code, $parent, $name]) {
            if ($dupes[strtolower($name)] > 1) {
                $names[$i] = $name . ' (' . (self::SECTIONS[$parent] ?? $parent) . ')';
            }
        }
        $dupes = $count($names);
        foreach ($leaves as $i => [$code]) {
            if ($dupes[strtolower($names[$i])] > 1) {
                $names[$i] = substr($names[$i], 0, -1) . ', ' . $code . ')';
            }
        }

        $rows = [];
        foreach ($leaves as $i => [$code, , , $description]) {
            $rows[] = [$code, $names[$i], $description];
        }

        return $rows;
    }

    public static function install(): void
    {
        $rows = static::rows(CostCodes::data()['accounts']);
        $now = now();

        DB::transaction(function () use ($rows, $now) {
            $existing = Master::type('expenseType')->get();
            $codes = $existing->pluck('code')->map(function ($c) { return strtoupper(trim((string) $c)); })->all();
            $names = $existing->pluck('name')->map(function ($n) { return strtolower(trim((string) $n)); })->all();

            foreach ($rows as [$code, $name, $description]) {
                if (in_array($code, $codes, true) || in_array(strtolower($name), $names, true)) {
                    continue;
                }
                DB::table('masters')->insert([
                    'type' => 'expenseType',
                    'code' => $code,
                    'name' => $name,
                    'status' => 'Active',
                    'data' => json_encode(['account' => $code, 'description' => $description]),
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            $chart = DB::table('accounts')->where('is_active', true)->pluck('code')->all();
            foreach ($existing as $type) {
                $d = $type->data ?: [];
                $account = trim((string) ($d['account'] ?? ''));
                $code = strtoupper(trim((string) $type->code));

                // Entered by hand with the cost code but no GL Account: link it.
                if ($account === '' && in_array($code, $chart, true)) {
                    $d['account'] = $code;
                    $type->data = $d;
                    $type->save();
                    continue;
                }

                // Retire types pointing at a GL account that isn't in the chart
                // (blank = default expense account, which still works — kept).
                if ($type->status !== 'Inactive' && $account !== '' && ! in_array($account, $chart, true)) {
                    $type->status = 'Inactive';
                    $type->save();
                }
            }
        });
    }
}
