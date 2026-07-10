<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddAuthToSalesReps extends Migration
{
    public function up()
    {
        Schema::table('sales_reps', function (Blueprint $table) {
            if (! Schema::hasColumn('sales_reps', 'email')) {
                $table->string('email')->nullable()->after('name');
            }
            if (! Schema::hasColumn('sales_reps', 'password')) {
                $table->string('password')->nullable()->after('email');
            }
            if (! Schema::hasColumn('sales_reps', 'phone')) {
                $table->string('phone')->nullable()->after('zone');
            }
            if (! Schema::hasColumn('sales_reps', 'branch')) {
                $table->string('branch')->nullable()->after('phone');
            }
        });

        // Add the unique index separately (guarded) so re-runs don't fail.
        try {
            Schema::table('sales_reps', function (Blueprint $table) {
                $table->unique('email');
            });
        } catch (\Throwable $e) {
            // Index already exists — ignore.
        }
    }

    public function down()
    {
        Schema::table('sales_reps', function (Blueprint $table) {
            $table->dropUnique(['email']);
            $table->dropColumn(['email', 'password', 'phone', 'branch']);
        });
    }
}
