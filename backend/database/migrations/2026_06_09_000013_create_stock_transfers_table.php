<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateStockTransfersTable extends Migration
{
    public function up()
    {
        Schema::create('stock_transfers', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();      // TRF-201
            $table->string('from_branch');
            $table->string('to_branch');
            $table->date('date');
            $table->integer('items')->default(0);
            $table->integer('qty')->default(0);
            $table->string('status', 16)->default('In Transit'); // In Transit | Completed
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('stock_transfers');
    }
}
