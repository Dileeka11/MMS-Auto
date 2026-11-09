<?php

use App\Services\Accounting\CostCodes;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Switch the Chart of Accounts to the NMS Auto cost codes (R1000 / E3000 /
 * A3100 / L4100 …) and give accounts a description. Existing accounts are
 * re-coded in place — see App\Services\Accounting\CostCodes.
 * Live host: database/sql/nms_cost_codes_live.sql.
 */
class InstallNmsCostCodes extends Migration
{
    public function up()
    {
        if (! Schema::hasColumn('accounts', 'description')) {
            Schema::table('accounts', function (Blueprint $table) {
                $table->string('description', 255)->nullable()->after('name');
            });
        }

        // The categories are seeded by AccountingSeeder; on a fresh database
        // the seeder installs the chart instead.
        if (DB::table('account_categories')->count() > 0) {
            CostCodes::install();
        }
    }

    public function down()
    {
        // Re-coded / merged accounts can't be restored — only the column goes.
        Schema::table('accounts', function (Blueprint $table) {
            $table->dropColumn('description');
        });
    }
}
