<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateItemsTable extends Migration
{
    public function up()
    {
        Schema::create('items', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('name');
            $table->string('category')->nullable();
            $table->string('brand')->nullable();
            $table->string('group')->nullable();
            $table->string('unit', 16)->default('Pcs');
            $table->decimal('avg_cost', 14, 2)->default(0);
            $table->decimal('fifo_cost', 14, 2)->default(0);
            $table->decimal('price', 14, 2)->default(0);
            $table->integer('qty')->default(0);
            $table->integer('reorder')->default(12);
            $table->json('stock_by_branch')->nullable();
            $table->string('rack', 32)->nullable();
            $table->string('status', 8)->default('in'); // in | low | out
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('items');
    }
}
