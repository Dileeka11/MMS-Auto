<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The chart was seeded twice for the same accounts (the 110000 series and the
 * "Stage-01" codes). Keep the 110000 series — auto-posting uses it — and fold
 * each Stage-01 duplicate into it: journal lines, opening balances and posting
 * mappings move over, then the duplicate is deactivated. A duplicate that has
 * sub-accounts is left alone (merging would turn the keeper into a header).
 *
 * 1001 HNB Bank Account and 2001 Accounts Payable are separate accounts and stay.
 * Same logic as section 5 of database/sql/accounting_posting_live.sql.
 */
class MergeDuplicateAccounts extends Migration
{
    /** duplicate code => keeper code */
    private const PAIRS = [
        '1002' => '110000', // Cash in Hand        → Cash
        '1003' => '110200', // Trade Receivables   → Trade Receivable
        '5001' => '110300', // Inventory / Stock   → Inventory
        '2002' => '210000', // Trade Payables      → Trade Payable
        '4001' => '410000', // Sales Revenue (S01) → Sales Revenue
        '5004' => '510000', // Cost of Sales (S01) → Cost of Sales
    ];

    public function up()
    {
        foreach (self::PAIRS as $dupCode => $keepCode) {
            $dup = DB::table('accounts')->where('code', $dupCode)->first();
            $keep = DB::table('accounts')->where('code', $keepCode)->first();
            if (! $dup || ! $keep || DB::table('accounts')->where('parent_id', $dup->id)->exists()) {
                continue;
            }

            DB::transaction(function () use ($dup, $keep) {
                DB::table('journal_lines')->where('account_id', $dup->id)->update(['account_id' => $keep->id]);
                DB::table('account_mappings')->where('account_id', $dup->id)->update(['account_id' => $keep->id]);

                // Opening balances: net into the keeper's row for the same year.
                foreach (DB::table('opening_balances')->where('account_id', $dup->id)->get() as $ob) {
                    $mine = DB::table('opening_balances')
                        ->where('financial_year_id', $ob->financial_year_id)
                        ->where('account_id', $keep->id)
                        ->first();
                    if (! $mine) {
                        DB::table('opening_balances')->where('id', $ob->id)->update(['account_id' => $keep->id]);
                        continue;
                    }
                    $net = round(($mine->debit - $mine->credit) + ($ob->debit - $ob->credit), 2);
                    DB::table('opening_balances')->where('id', $mine->id)->update([
                        'debit' => max(0, $net),
                        'credit' => max(0, -$net),
                    ]);
                    DB::table('opening_balances')->where('id', $ob->id)->delete();
                }

                DB::table('accounts')->where('id', $dup->id)->update([
                    'is_active' => false,
                    'name' => mb_substr("{$dup->name} (merged into {$keep->code})", 0, 150),
                ]);
            });
        }
    }

    public function down()
    {
        // Merged postings can't be told apart again — irreversible by design.
    }
}
