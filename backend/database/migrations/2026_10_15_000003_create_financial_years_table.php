<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Financial Year (Fiscal Year) table. Seeds the first year (2026/2027, active).
 *
 * No DB-level FK constraints — the live host rejects them (errno 150).
 * Integrity is enforced at the app layer.
 */
class CreateFinancialYearsTable extends Migration
{
    public function up()
    {
        Schema::create('financial_years', function (Blueprint $table) {
            $table->id();
            $table->string('year_name', 20);
            $table->date('start_date');
            $table->date('end_date');
            $table->boolean('is_active')->default(false);
            $table->timestamps();
        });

        DB::table('financial_years')->insert([
            'year_name'  => '2026/2027',
            'start_date' => '2026-04-01',
            'end_date'   => '2027-03-31',
            'is_active'  => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down()
    {
        Schema::dropIfExists('financial_years');
    }
}
