<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateQuotationsTable extends Migration
{
    public function up()
    {
        Schema::create('quotations', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();      // QT-9100
            $table->string('customer');
            $table->string('rep')->nullable();
            $table->date('date');
            $table->date('valid_until')->nullable();
            $table->decimal('total', 14, 2)->default(0);
            $table->integer('items')->default(0);
            $table->string('status', 16)->default('Open'); // Open | Converted | Expired
            $table->string('cost', 16)->default('-');       // FIFO | Average | -
            $table->timestamps();
        });

        Schema::create('quotation_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quotation_id')->constrained()->cascadeOnDelete();
            $table->string('code')->nullable();
            $table->string('name');
            $table->integer('qty')->default(1);
            $table->decimal('rate', 14, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('quotation_lines');
        Schema::dropIfExists('quotations');
    }
}
