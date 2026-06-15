<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class ExtendPurchaseOrdersForPoFlow extends Migration
{
    public function up()
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->string('pi_number')->nullable()->after('supplier');
            $table->date('pi_date')->nullable()->after('pi_number');
            $table->string('payment_terms')->nullable()->after('pi_date');
            $table->string('inco_terms')->nullable()->after('payment_terms');
            $table->string('currency', 8)->default('LKR')->after('inco_terms');
            $table->string('supplier_contact')->nullable()->after('currency');
            $table->text('notes')->nullable()->after('supplier_contact');
        });

        Schema::table('purchase_order_lines', function (Blueprint $table) {
            $table->integer('balance_qty')->default(0)->after('qty');
            $table->integer('received_qty')->default(0)->after('balance_qty');
        });
    }

    public function down()
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropColumn(['pi_number', 'pi_date', 'payment_terms', 'inco_terms', 'currency', 'supplier_contact', 'notes']);
        });
        Schema::table('purchase_order_lines', function (Blueprint $table) {
            $table->dropColumn(['balance_qty', 'received_qty']);
        });
    }
}
