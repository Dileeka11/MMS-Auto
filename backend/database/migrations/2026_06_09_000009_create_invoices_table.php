<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateInvoicesTable extends Migration
{
    public function up()
    {
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();      // INV-5500
            $table->string('quotation')->nullable(); // source quote code
            $table->string('customer');
            $table->string('rep')->nullable();
            $table->date('date');
            $table->decimal('total', 14, 2)->default(0);
            $table->decimal('paid', 14, 2)->default(0);
            $table->decimal('due', 14, 2)->default(0);
            $table->integer('items')->default(0);
            $table->string('cost', 16)->default('Mixed'); // FIFO | Average | Mixed
            $table->string('status', 16)->default('Unpaid'); // Paid | Partial | Unpaid
            $table->timestamps();
        });

        Schema::create('invoice_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained()->cascadeOnDelete();
            $table->string('code')->nullable();
            $table->string('name');
            $table->integer('qty')->default(1);
            $table->decimal('rate', 14, 2)->default(0);
            $table->decimal('fifo_cost', 14, 2)->default(0);
            $table->decimal('avg_cost', 14, 2)->default(0);
            $table->string('method', 8)->default('FIFO'); // FIFO | Average — per line
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('invoice_lines');
        Schema::dropIfExists('invoices');
    }
}
