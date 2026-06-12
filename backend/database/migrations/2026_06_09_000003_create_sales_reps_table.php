<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateSalesRepsTable extends Migration
{
    public function up()
    {
        Schema::create('sales_reps', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();      // REP-01
            $table->string('name');
            $table->string('zone')->nullable();
            $table->decimal('target', 14, 2)->default(0);
            $table->decimal('achieved', 14, 2)->default(0);
            $table->integer('visits')->default(0);
            $table->integer('invoices')->default(0);
            $table->string('avatar', 4)->nullable();
            $table->string('login')->nullable();
            $table->boolean('app_enabled')->default(true);
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('sales_reps');
    }
}
