<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddDiscountsToSales extends Migration
{
    public function up()
    {
        Schema::table('sales_orders', function (Blueprint $table) {
            $table->decimal('discount_pct', 5, 2)->default(0);
            $table->string('discount_status', 16)->nullable(); // pending | approved | rejected
        });
        Schema::table('invoices', function (Blueprint $table) {
            $table->decimal('discount_pct', 5, 2)->default(0);
            $table->string('discount_status', 16)->nullable(); 
        });
    }

    public function down()
    {
        Schema::table('sales_orders', function (Blueprint $table) {
            $table->dropColumn(['discount_pct', 'discount_status']);
        });
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn(['discount_pct', 'discount_status']);
        });
    }
}
