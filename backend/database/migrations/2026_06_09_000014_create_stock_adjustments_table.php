<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateStockAdjustmentsTable extends Migration
{
    public function up()
    {
        Schema::create('stock_adjustments', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();      // ADJ-101
            $table->string('item');
            $table->string('item_code')->nullable();
            $table->string('type', 12)->default('Increase'); // Increase | Decrease
            $table->integer('qty')->default(0);
            $table->string('reason')->nullable();
            $table->date('date');
            $table->string('by')->nullable();
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('stock_adjustments');
    }
}
