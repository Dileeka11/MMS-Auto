<?php

namespace Database\Seeders;

use App\Models\Account;
use App\Models\AccountCategory;
use App\Models\AccountMapping;
use App\Services\Accounting\CostCodes;
use App\Services\Accounting\Posting;
use Illuminate\Database\Seeder;

/**
 * Seeds the double-entry Chart of Accounts: the 5 top-level categories, then
 * the NMS Auto cost-code chart (groups + accounts, see CostCodes) and the
 * auto-posting role mappings. Idempotent, so re-running never duplicates.
 */
class AccountingSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Categories — normal_balance encodes the double-entry rules.
        $categories = [
            ['code' => '1000', 'name' => 'Assets',      'normal_balance' => 'debit',  'statement_type' => 'BS'],
            ['code' => '2000', 'name' => 'Liabilities', 'normal_balance' => 'credit', 'statement_type' => 'BS'],
            ['code' => '3000', 'name' => 'Equity',      'normal_balance' => 'credit', 'statement_type' => 'BS'],
            ['code' => '4000', 'name' => 'Income',      'normal_balance' => 'credit', 'statement_type' => 'PNL'],
            ['code' => '5000', 'name' => 'Expenses',    'normal_balance' => 'debit',  'statement_type' => 'PNL'],
        ];
        foreach ($categories as $c) {
            AccountCategory::firstOrCreate(['code' => $c['code']], $c);
        }

        // 2. Groups + accounts — the NMS Auto cost-code chart.
        CostCodes::install();

        // 3. Auto-posting roles → their default accounts (Accounting → Posting Setup).
        $accountIdByCode = Account::pluck('id', 'code');
        foreach (Posting::ROLES as $key => $role) {
            AccountMapping::firstOrCreate(['key' => $key], ['account_id' => $accountIdByCode[$role[1]] ?? null]);
        }
    }
}
