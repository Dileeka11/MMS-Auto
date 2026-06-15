<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateCompanyProfilesTable extends Migration
{
    public function up()
    {
        Schema::create('company_profiles', function (Blueprint $table) {
            $table->id();
            $table->string('name')->default('NMS-Auto');
            $table->string('tagline')->nullable();
            $table->text('address')->nullable();
            $table->string('phone', 32)->nullable();
            $table->string('email')->nullable();
            $table->string('tax_no', 64)->nullable();
            $table->string('currency', 64)->default('LKR — Sri Lankan Rupee');
            $table->string('logo_path')->nullable();
            $table->string('favicon_path')->nullable();
            $table->string('accent', 16)->default('blue');
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('company_profiles');
    }
}
