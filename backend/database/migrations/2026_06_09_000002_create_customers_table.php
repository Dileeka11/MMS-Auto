<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateCustomersTable extends Migration
{
    public function up()
    {
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->string('code')->nullable();
            $table->string('name');
            $table->string('contact', 32)->nullable();
            $table->string('city', 64)->nullable();
            $table->integer('credit')->default(30);
            $table->decimal('limit', 14, 2)->default(0);
            $table->decimal('outstanding', 14, 2)->default(0);
            $table->string('rep')->nullable();
            $table->string('status', 8)->default('ok'); // ok | risk
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('customers');
    }
}
