<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddVatToInvoices extends Migration
{
    public function up()
    {
        Schema::table('company_profiles', function (Blueprint $table) {
            $table->decimal('vat_pct', 5, 2)->default(18);
        });
        Schema::table('customers', function (Blueprint $table) {
            $table->string('tax_no', 64)->nullable(); // purchaser's TIN / VAT no
            $table->text('address')->nullable();
        });
        Schema::table('invoices', function (Blueprint $table) {
            $table->boolean('vat_applied')->default(false);
            $table->decimal('vat_pct', 5, 2)->default(0);
            $table->decimal('vat_amount', 14, 2)->default(0); // included in total
        });
    }

    public function down()
    {
        Schema::table('company_profiles', function (Blueprint $table) {
            $table->dropColumn('vat_pct');
        });
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn(['tax_no', 'address']);
        });
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn(['vat_applied', 'vat_pct', 'vat_amount']);
        });
    }
}
