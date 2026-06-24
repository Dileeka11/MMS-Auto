<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateSuppliersTable extends Migration
{
    public function up()
    {
        Schema::create('suppliers', function (Blueprint $table) {
            $table->id();
            $table->string('code')->nullable();
            $table->string('name');
            $table->string('contact', 64)->nullable();
            $table->string('email')->nullable();
            $table->string('city', 64)->nullable();
            $table->string('country', 64)->nullable();
            $table->string('tax_no', 64)->nullable();
            $table->string('payment_terms', 32)->nullable();
            $table->string('currency', 8)->nullable();
            $table->text('address')->nullable();
            $table->text('notes')->nullable();
            $table->string('status', 16)->default('Active');
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('suppliers');
    }
}
