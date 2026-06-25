<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddApprovalsToShipmentsAndGrns extends Migration
{
    public function up()
    {
        foreach (['shipments', 'grns'] as $tbl) {
            // Widen status column so 'Awaiting Approval' fits
            \DB::statement("ALTER TABLE {$tbl} MODIFY status VARCHAR(50) NOT NULL DEFAULT ''");

            Schema::table($tbl, function (Blueprint $table) use ($tbl) {
                if (!Schema::hasColumn($tbl, 'approver1_id')) {
                    $table->unsignedBigInteger('approver1_id')->nullable()->after('status');
                }
                if (!Schema::hasColumn($tbl, 'approver1_at')) {
                    $table->timestamp('approver1_at')->nullable()->after('approver1_id');
                }
                if (!Schema::hasColumn($tbl, 'approver2_id')) {
                    $table->unsignedBigInteger('approver2_id')->nullable()->after('approver1_at');
                }
                if (!Schema::hasColumn($tbl, 'approver2_at')) {
                    $table->timestamp('approver2_at')->nullable()->after('approver2_id');
                }
                if (!Schema::hasColumn($tbl, 'rejected_by_id')) {
                    $table->unsignedBigInteger('rejected_by_id')->nullable()->after('approver2_at');
                }
                if (!Schema::hasColumn($tbl, 'rejected_at')) {
                    $table->timestamp('rejected_at')->nullable()->after('rejected_by_id');
                }
                if (!Schema::hasColumn($tbl, 'reject_reason')) {
                    $table->string('reject_reason')->nullable()->after('rejected_at');
                }
            });

            // Add foreign keys only if not already present
            try {
                Schema::table($tbl, function (Blueprint $table) use ($tbl) {
                    $table->foreign('approver1_id', $tbl.'_approver1_fk')->references('id')->on('users')->nullOnDelete();
                });
            } catch (\Throwable $e) { /* already exists */ }
            try {
                Schema::table($tbl, function (Blueprint $table) use ($tbl) {
                    $table->foreign('approver2_id', $tbl.'_approver2_fk')->references('id')->on('users')->nullOnDelete();
                });
            } catch (\Throwable $e) { /* already exists */ }
            try {
                Schema::table($tbl, function (Blueprint $table) use ($tbl) {
                    $table->foreign('rejected_by_id', $tbl.'_rejected_by_fk')->references('id')->on('users')->nullOnDelete();
                });
            } catch (\Throwable $e) { /* already exists */ }
        }

        // Existing rows enter the new workflow.
        \DB::table('shipments')->whereIn('status', ['Costed'])->update(['status' => 'Awaiting Approval']);
        \DB::table('grns')->whereIn('status', ['Draft'])->update(['status' => 'Awaiting Approval']);
    }

    public function down()
    {
        foreach (['shipments', 'grns'] as $tbl) {
            Schema::table($tbl, function (Blueprint $table) use ($tbl) {
                $table->dropForeign($tbl.'_approver1_fk');
                $table->dropForeign($tbl.'_approver2_fk');
                $table->dropForeign($tbl.'_rejected_by_fk');
                $table->dropColumn([
                    'approver1_id', 'approver1_at',
                    'approver2_id', 'approver2_at',
                    'rejected_by_id', 'rejected_at', 'reject_reason',
                ]);
            });
        }
    }
}
