<?php

use App\Services\Accounting\ExpenseTypes;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Load Master Files → Expense Type from the "E" cost codes (one type per
 * postable E-account, GL Account = its cost code) and retire the old demo
 * types whose GL account isn't in the chart. See App\Services\Accounting\ExpenseTypes.
 * Live host: database/sql/expense_types_live.sql.
 */
class InstallExpenseTypes extends Migration
{
    public function up()
    {
        // On a fresh database the chart isn't there yet — AccountingSeeder installs both.
        if (DB::table('accounts')->where('code', 'E4520')->exists()) {
            ExpenseTypes::install();
        }
    }

    public function down()
    {
        // Expense types may already be used by expenses — leave them.
    }
}
