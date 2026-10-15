<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Opening Balances — links a financial year to each Chart of Account
 * with its opening debit/credit balance.
 *
 * No DB-level FK — live host rejects (errno 150); integrity enforced in app layer.
 */
class CreateOpeningBalancesTable extends Migration
{
    public function up()
    {
        Schema::create('opening_balances', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('financial_year_id')->index();  // → financial_years.id
            $table->unsignedBigInteger('account_id')->index();         // → accounts.id
            $table->decimal('debit', 15, 2)->default(0.00);
            $table->decimal('credit', 15, 2)->default(0.00);
            $table->timestamps();

            // One opening balance record per account per year.
            $table->unique(['financial_year_id', 'account_id'], 'uq_ob_year_account');
        });
    }

    public function down()
    {
        Schema::dropIfExists('opening_balances');
    }
}
