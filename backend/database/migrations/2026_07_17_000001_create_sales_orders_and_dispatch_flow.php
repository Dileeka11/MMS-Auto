<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sales-order → dispatch-note → invoice flow.
 *
 * App orders no longer post an invoice + reduce stock immediately. They now
 * land as a sales_order (pending). Dispatching reserves stock; converting to
 * an invoice reduces on-hand stock and releases the reservation.
 */
class CreateSalesOrdersAndDispatchFlow extends Migration
{
    public function up()
    {
        Schema::create('sales_orders', function (Blueprint $table) {
            $table->id();
            $table->string('code', 20)->unique();       // SO-xxxx
            $table->string('customer');
            $table->string('rep')->nullable();
            $table->string('source', 8)->default('app'); // app | web
            $table->date('date');
            $table->decimal('total', 14, 2)->default(0);
            $table->integer('items')->default(0);
            $table->string('status', 16)->default('pending'); // pending | dispatched | invoiced | cancelled
            $table->string('dispatch_no', 20)->nullable();    // DN-xxxx
            $table->date('dispatch_date')->nullable();
            $table->string('invoice_code', 20)->nullable();   // linked INV-xxxx
            $table->timestamps();
            $table->index('status');
        });

        Schema::create('sales_order_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sales_order_id')->constrained()->cascadeOnDelete();
            $table->string('code')->nullable();
            $table->string('name');
            $table->integer('qty')->default(1);
            $table->decimal('rate', 14, 2)->default(0);
            $table->decimal('fifo_cost', 14, 2)->default(0);
            $table->decimal('avg_cost', 14, 2)->default(0);
            $table->string('method', 8)->default('FIFO');
            $table->timestamps();
        });

        Schema::table('items', function (Blueprint $table) {
            $table->integer('reserved')->default(0)->after('qty');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->string('terms', 24)->default('Cash')->after('source'); // Cash | Cheque | Credit (30 days)
        });

        Schema::table('receipts', function (Blueprint $table) {
            $table->string('cheque_no', 48)->nullable();
            $table->string('bank_acc', 48)->nullable();
        });
    }

    public function down()
    {
        Schema::table('receipts', function (Blueprint $table) {
            $table->dropColumn(['cheque_no', 'bank_acc']);
        });
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn('terms');
        });
        Schema::table('items', function (Blueprint $table) {
            $table->dropColumn('reserved');
        });
        Schema::dropIfExists('sales_order_lines');
        Schema::dropIfExists('sales_orders');
    }
}
