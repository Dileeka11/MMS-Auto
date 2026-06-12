<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateGrnsTable extends Migration
{
    public function up()
    {
        Schema::create('grns', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();      // GRN-7700
            $table->string('po')->nullable();      // against PO code
            $table->string('supplier');
            $table->date('date');
            $table->integer('items')->default(0);
            $table->decimal('total', 14, 2)->default(0);
            $table->string('status', 16)->default('Posted'); // Posted | Draft
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('grns');
    }
}
