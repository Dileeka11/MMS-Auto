<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Credit sales carry a credit period: invoices.credit_days is the number of
 * days allowed and invoices.due_date is when payment falls due
 * (invoice date + credit_days). Both stay null for cash / card sales.
 */
class AddCreditTermsToInvoices extends Migration
{
    public function up()
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->unsignedSmallInteger('credit_days')->nullable()->after('terms');
            $table->date('due_date')->nullable()->after('credit_days');
        });
    }

    public function down()
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn(['credit_days', 'due_date']);
        });
    }
}
