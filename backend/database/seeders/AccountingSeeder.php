<?php

namespace Database\Seeders;

use App\Models\Account;
use App\Models\AccountCategory;
use App\Models\AccountGroup;
use Illuminate\Database\Seeder;

/**
 * Seeds the standard double-entry Chart of Accounts: the 5 top-level
 * categories, sample groups, and the default ledger accounts used by any
 * posting rules. Idempotent (firstOrCreate) so re-running never duplicates.
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

        // 2. Groups — keyed to their category by code.
        $groups = [
            ['code' => '1100', 'name' => 'Current Assets',         'category' => '1000'],
            ['code' => '1200', 'name' => 'Non Current Assets',     'category' => '1000'],
            ['code' => '2100', 'name' => 'Current Liabilities',    'category' => '2000'],
            ['code' => '2200', 'name' => 'Long Term Liabilities',  'category' => '2000'],
            ['code' => '3100', 'name' => 'Owner Equity',           'category' => '3000'],
            ['code' => '4100', 'name' => 'Operating Income',       'category' => '4000'],
            ['code' => '5100', 'name' => 'Administrative Expenses','category' => '5000'],
            ['code' => '5200', 'name' => 'Selling Expenses',       'category' => '5000'],
        ];
        $categoryIdByCode = AccountCategory::pluck('id', 'code');
        foreach ($groups as $g) {
            AccountGroup::firstOrCreate(
                ['code' => $g['code']],
                ['name' => $g['name'], 'category_id' => $categoryIdByCode[$g['category']]],
            );
        }

        // 3. Default accounts — the standard ledger accounts posting rules use.
        $accounts = [
            ['code' => '110000', 'name' => 'Cash',                    'group' => '1100'],
            ['code' => '110100', 'name' => 'Bank',                    'group' => '1100'],
            ['code' => '110200', 'name' => 'Trade Receivable',        'group' => '1100'],
            ['code' => '110300', 'name' => 'Inventory',               'group' => '1100'],
            ['code' => '110400', 'name' => 'VAT Input (Recoverable)', 'group' => '1100'],
            ['code' => '210000', 'name' => 'Trade Payable',           'group' => '2100'],
            ['code' => '210100', 'name' => 'VAT Output (Payable)',    'group' => '2100'],
            ['code' => '410000', 'name' => 'Sales Revenue',           'group' => '4100'],
            ['code' => '510000', 'name' => 'Cost of Sales',           'group' => '5100'],
            ['code' => '520000', 'name' => 'Cash Discount Given',     'group' => '5200'],

            // ── Stage-01 account master (exact codes from the spec) ──────────
            // Merged into the existing chart; each account sits under the group
            // that matches its accounting type.
            ['code' => '1001', 'name' => 'HNB Bank Account',        'group' => '1100'],
            ['code' => '1002', 'name' => 'Cash in Hand',            'group' => '1100'],
            ['code' => '1003', 'name' => 'Trade Receivables',       'group' => '1100'],
            ['code' => '1004', 'name' => 'Prepayments',             'group' => '1100'],
            ['code' => '1005', 'name' => 'Fixed Assets',            'group' => '1200'],
            ['code' => '5001', 'name' => 'Inventory / Stock',       'group' => '1100'],
            ['code' => '2001', 'name' => 'Accounts Payable',        'group' => '2100'],
            ['code' => '2002', 'name' => 'Trade Payables',          'group' => '2100'],
            ['code' => '2003', 'name' => 'Accrued Expenses',        'group' => '2100'],
            ['code' => '2004', 'name' => 'Loans',                   'group' => '2200'],
            ['code' => '2005', 'name' => 'Tax Payable',             'group' => '2100'],
            ['code' => '3001', 'name' => 'Share Capital',           'group' => '3100'],
            ['code' => '3002', 'name' => 'Retained Earnings',       'group' => '3100'],
            ['code' => '4001', 'name' => 'Sales Revenue (Stage 01)', 'group' => '4100'],
            ['code' => '4002', 'name' => 'Other Income',            'group' => '4100'],
            ['code' => '5002', 'name' => 'Office Stationery Expense', 'group' => '5100'],
            ['code' => '5003', 'name' => 'IT Equipment Expense',    'group' => '5100'],
            ['code' => '5004', 'name' => 'Cost of Sales (Stage 01)', 'group' => '5100'],
            ['code' => '5005', 'name' => 'Salaries',                'group' => '5100'],
            ['code' => '5006', 'name' => 'Rent',                    'group' => '5100'],
            ['code' => '5007', 'name' => 'Utilities',               'group' => '5100'],
            ['code' => '5008', 'name' => 'Finance Costs',           'group' => '5100'],
            ['code' => '5009', 'name' => 'Administrative Expenses', 'group' => '5100'],
            ['code' => '5010', 'name' => 'Selling & Distribution Expenses', 'group' => '5200'],
        ];
        $groupIdByCode = AccountGroup::pluck('id', 'code');
        foreach ($accounts as $a) {
            Account::firstOrCreate(
                ['code' => $a['code']],
                [
                    'name' => $a['name'],
                    'group_id' => $groupIdByCode[$a['group']],
                    'is_active' => true,
                    'is_default' => true,
                    'created_by' => 'system',
                ],
            );
        }
    }
}
