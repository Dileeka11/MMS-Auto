<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddApprovalsToPurchaseOrders extends Migration
{
    public function up()
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->unsignedBigInteger('approver1_id')->nullable()->after('status');
            $table->timestamp('approver1_at')->nullable()->after('approver1_id');
            $table->unsignedBigInteger('approver2_id')->nullable()->after('approver1_at');
            $table->timestamp('approver2_at')->nullable()->after('approver2_id');
            $table->unsignedBigInteger('rejected_by_id')->nullable()->after('approver2_at');
            $table->timestamp('rejected_at')->nullable()->after('rejected_by_id');
            $table->string('reject_reason')->nullable()->after('rejected_at');

            $table->foreign('approver1_id')->references('id')->on('users')->nullOnDelete();
            $table->foreign('approver2_id')->references('id')->on('users')->nullOnDelete();
            $table->foreign('rejected_by_id')->references('id')->on('users')->nullOnDelete();
        });

        // Any historic POs with Pending status get bumped to Awaiting Approval so they enter the new workflow.
        \DB::table('purchase_orders')->where('status', 'Pending')->update(['status' => 'Awaiting Approval']);
    }

    public function down()
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropForeign(['approver1_id']);
            $table->dropForeign(['approver2_id']);
            $table->dropForeign(['rejected_by_id']);
            $table->dropColumn([
                'approver1_id', 'approver1_at',
                'approver2_id', 'approver2_at',
                'rejected_by_id', 'rejected_at', 'reject_reason',
            ]);
        });
    }
}
