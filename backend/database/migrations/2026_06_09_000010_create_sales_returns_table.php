<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateSalesReturnsTable extends Migration
{
    public function up()
    {
        Schema::create('sales_returns', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();      // SR-3300
            $table->string('invoice')->nullable();
            $table->string('customer');
            $table->string('rep')->nullable();
            $table->date('date');
            $table->decimal('amount', 14, 2)->default(0);
            $table->integer('items')->default(1);
            $table->string('reason')->nullable();
            // Pending Approval | Approved | Rejected — stock is restored only on approval
            $table->string('status', 24)->default('Pending Approval');
            $table->string('raised_by')->nullable();
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('sales_returns');
    }
}
