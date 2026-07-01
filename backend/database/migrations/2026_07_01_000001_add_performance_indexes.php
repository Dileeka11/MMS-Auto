<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Indexes on the columns the dashboard aggregates and list screens sort/filter by.
 * These are read-heavy, low-cardinality-friendly columns with no index yet.
 */
class AddPerformanceIndexes extends Migration
{
    public function up()
    {
        Schema::table('items', function (Blueprint $table) {
            $table->index('status');    // dashboard low/out aggregates + low_stock order
            $table->index('category');  // dashboard stock-by-category groupBy
            $table->index('name');      // Item Master list orders by name
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->index('date');      // dashboard month/12-month trend queries
        });
    }

    public function down()
    {
        Schema::table('items', function (Blueprint $table) {
            $table->dropIndex(['status']);
            $table->dropIndex(['category']);
            $table->dropIndex(['name']);
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropIndex(['date']);
        });
    }
}
