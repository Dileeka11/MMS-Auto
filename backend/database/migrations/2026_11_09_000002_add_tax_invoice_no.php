<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * IRD SEC/2026/E/03 clause 4.4 — Tax Invoice serial number
 * YYMMM_QQQQ_XXXXX (e.g. 26NOV_VAT_00001).
 *
 * invoices.tax_invoice_no holds the serial for VAT invoices; the internal
 * INV-xxxx code is unchanged. company_profiles.invoice_class is the QQQQ part.
 * Existing VAT invoices are numbered in the order they were raised.
 */
class AddTaxInvoiceNo extends Migration
{
    public function up()
    {
        Schema::table('company_profiles', function (Blueprint $table) {
            $table->string('invoice_class', 15)->default('VAT');
        });
        Schema::table('invoices', function (Blueprint $table) {
            $table->string('tax_invoice_no', 40)->nullable()->unique();
        });

        $seq = 0;
        DB::table('invoices')->where('vat_applied', 1)->orderBy('id')->get(['id', 'date'])
            ->each(function ($r) use (&$seq) {
                $seq++;
                $d = \Carbon\Carbon::parse($r->date ?: now());
                DB::table('invoices')->where('id', $r->id)->update([
                    'tax_invoice_no' => $d->format('y') . strtoupper($d->format('M')) . '_VAT_' . str_pad((string) $seq, 5, '0', STR_PAD_LEFT),
                ]);
            });
    }

    public function down()
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropUnique(['tax_invoice_no']);
            $table->dropColumn('tax_invoice_no');
        });
        Schema::table('company_profiles', function (Blueprint $table) {
            $table->dropColumn('invoice_class');
        });
    }
}
