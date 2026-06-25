<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AddItemIdToPurchaseOrderLines extends Migration
{
    public function up()
    {
        Schema::table('purchase_order_lines', function (Blueprint $table) {
            $table->foreignId('item_id')->nullable()->after('purchase_order_id')
                ->constrained('items')->nullOnDelete();
            $table->index('item_id');
        });

        // Backfill from existing code matches.
        DB::statement('
            UPDATE purchase_order_lines pol
            JOIN items i ON UPPER(TRIM(i.code)) = UPPER(TRIM(pol.code))
            SET pol.item_id = i.id
            WHERE pol.item_id IS NULL AND pol.code IS NOT NULL
        ');
    }

    public function down()
    {
        Schema::table('purchase_order_lines', function (Blueprint $table) {
            $table->dropForeign(['item_id']);
            $table->dropIndex(['item_id']);
            $table->dropColumn('item_id');
        });
    }
}
