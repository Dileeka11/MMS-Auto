<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Item-level sales returns: which invoice lines (and how many) come back, so
 * approval can restock them and reverse their cost of sales. Returns raised
 * before this (amount only, no lines) keep working as credit-only returns.
 *
 * No DB-level FK — live host rejects (errno 150).
 */
class AddLinesToSalesReturns extends Migration
{
    public function up()
    {
        Schema::create('sales_return_lines', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('sales_return_id')->index();
            $table->unsignedBigInteger('invoice_line_id')->nullable()->index();
            $table->string('code')->nullable();
            $table->string('name');
            $table->integer('qty');
            $table->decimal('rate', 14, 2)->default(0);      // net selling rate (after invoice discount, ex-VAT)
            $table->decimal('unit_cost', 14, 2)->default(0); // cost the sale was booked at
            $table->timestamps();
        });

        Schema::table('sales_returns', function (Blueprint $table) {
            $table->decimal('vat_amount', 14, 2)->default(0); // included in amount
            $table->boolean('restocked')->default(false);
        });
    }

    public function down()
    {
        Schema::dropIfExists('sales_return_lines');

        Schema::table('sales_returns', function (Blueprint $table) {
            $table->dropColumn(['vat_amount', 'restocked']);
        });
    }
}
