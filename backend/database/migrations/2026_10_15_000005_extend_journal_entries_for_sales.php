<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Extend journal_entries with:
 *  - financial_year_id  : link to the active financial year
 *  - invoice_number     : Sales Invoice / document reference number
 *  - customer_name      : denormalised customer name (fast search / display)
 *  - payment_method     : 'cash_in_hand' | 'bank'
 *  - payment_account_id : the Chart of Account used for the payment leg
 *
 * No DB-level FK — live host rejects (errno 150).
 */
class ExtendJournalEntriesForSales extends Migration
{
    public function up()
    {
        Schema::table('journal_entries', function (Blueprint $table) {
            $table->unsignedBigInteger('financial_year_id')->nullable()->index();
            $table->string('invoice_number', 30)->nullable();
            $table->string('customer_name', 150)->nullable();
            $table->string('payment_method', 20)->nullable();
            $table->unsignedBigInteger('payment_account_id')->nullable()->index();
        });
    }

    public function down()
    {
        Schema::table('journal_entries', function (Blueprint $table) {
            $table->dropIndex(['financial_year_id']);
            $table->dropIndex(['payment_account_id']);
            $table->dropColumn(['financial_year_id', 'invoice_number', 'customer_name', 'payment_method', 'payment_account_id']);
        });
    }
}
