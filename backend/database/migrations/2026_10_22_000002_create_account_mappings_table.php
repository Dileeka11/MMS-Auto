<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Auto-posting setup: which ledger account each ERP posting role uses
 * (receivable, sales, VAT output, inventory, …). One row per role key;
 * App\Services\Accounting\Posting falls back to the role's default account
 * code when a row is missing, so an empty table still posts.
 *
 * Also stores the unit cost on stock adjustments so their journal value is
 * fixed at posting time (re-posting later must not pick up a newer avg cost).
 *
 * No DB-level FK — live host rejects (errno 150).
 */
class CreateAccountMappingsTable extends Migration
{
    public function up()
    {
        Schema::create('account_mappings', function (Blueprint $table) {
            $table->id();
            $table->string('key', 40)->unique();
            $table->unsignedBigInteger('account_id')->nullable()->index();
            $table->timestamps();
        });

        Schema::table('stock_adjustments', function (Blueprint $table) {
            $table->decimal('unit_cost', 14, 2)->nullable();
        });
    }

    public function down()
    {
        Schema::dropIfExists('account_mappings');

        Schema::table('stock_adjustments', function (Blueprint $table) {
            $table->dropColumn('unit_cost');
        });
    }
}
