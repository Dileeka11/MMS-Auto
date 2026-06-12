<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateReceiptsTable extends Migration
{
    public function up()
    {
        Schema::create('receipts', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();      // RCP-6600
            $table->string('customer');
            $table->date('date');
            $table->decimal('amount', 14, 2)->default(0);
            $table->string('mode', 24)->default('Cash'); // Cash | Cheque | Bank Transfer | Card
            $table->string('against')->nullable();        // INV code or "On Account"
            $table->string('reference')->nullable();
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('receipts');
    }
}
