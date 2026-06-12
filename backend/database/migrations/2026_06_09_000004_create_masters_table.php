<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Generic table powering the 16 config-driven master files
 * (vehicleBrand, vehicleModel, brand, brandCat, group, services,
 *  department, employee, payment, bank, country, branch,
 *  expenseType, credit, remark, salesExec).
 * The "type" column maps to the front-end /api/masters/{type} endpoint.
 * Type-specific fields are stored in the JSON "data" column.
 */
class CreateMastersTable extends Migration
{
    public function up()
    {
        Schema::create('masters', function (Blueprint $table) {
            $table->id();
            $table->string('type', 32)->index();
            $table->string('code', 32)->nullable();
            $table->string('name')->nullable();
            $table->json('data')->nullable();
            $table->string('status', 12)->default('Active');
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('masters');
    }
}
