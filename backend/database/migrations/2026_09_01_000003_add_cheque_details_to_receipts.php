<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddChequeDetailsToReceipts extends Migration
{
    public function up()
    {
        Schema::table('receipts', function (Blueprint $table) {
            $table->string('cheque_bank_name')->nullable();
            $table->date('cheque_date')->nullable();
        });
    }

    public function down()
    {
        Schema::table('receipts', function (Blueprint $table) {
            $table->dropColumn(['cheque_bank_name', 'cheque_date']);
        });
    }
}
