<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Local Ex-Showroom purchases skip Costing & Shipment and are received
 * straight against the PO, so a GRN line can no longer reach its PO line only
 * through a shipment line. grn_lines.purchase_order_line_id holds that link
 * directly; existing lines are backfilled from their shipment line.
 */
class AddPoLineToGrnLines extends Migration
{
    public function up()
    {
        Schema::table('grn_lines', function (Blueprint $table) {
            $table->foreignId('purchase_order_line_id')->nullable()->after('shipment_line_id')
                ->constrained()->nullOnDelete();
        });

        DB::statement(
            'UPDATE grn_lines gl JOIN shipment_lines sl ON sl.id = gl.shipment_line_id
                SET gl.purchase_order_line_id = sl.purchase_order_line_id
              WHERE gl.purchase_order_line_id IS NULL'
        );
    }

    public function down()
    {
        Schema::table('grn_lines', function (Blueprint $table) {
            $table->dropConstrainedForeignId('purchase_order_line_id');
        });
    }
}
