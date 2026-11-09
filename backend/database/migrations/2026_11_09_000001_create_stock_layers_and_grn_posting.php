<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * FIFO stock layers + GRN-on-approval.
 *  - stock_layers: one row per batch of stock received (GRN line, return,
 *    adjustment, opening). qty_left drops as sales consume it oldest-first.
 *  - stock_layer_moves: what each sale / decrease took from which layer, so
 *    deleting the document can put it back.
 *  - grns.stock_posted_at: set when the GRN actually moved stock (on its
 *    second approval). Existing GRNs already moved stock when they were saved.
 *  - Every item with stock on hand gets an "opening" layer at its current
 *    FIFO cost (or avg cost when that is 0).
 *
 * No DB-level FK — live host rejects (errno 150).
 */
class CreateStockLayersAndGrnPosting extends Migration
{
    public function up()
    {
        Schema::create('stock_layers', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('item_id');
            $table->string('source_type', 20);           // opening | grn | return | adjust | sync
            $table->unsignedBigInteger('source_id')->nullable();
            $table->date('date');
            $table->integer('qty_in');
            $table->integer('qty_left');
            $table->decimal('unit_cost', 14, 4)->default(0);
            $table->timestamps();
            $table->index(['item_id', 'qty_left']);
            $table->index(['source_type', 'source_id']);
        });

        Schema::create('stock_layer_moves', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('stock_layer_id');
            $table->unsignedBigInteger('item_id');
            $table->string('source_type', 20);           // invoice | adjust
            $table->unsignedBigInteger('source_id')->nullable();
            $table->integer('qty');
            $table->decimal('unit_cost', 14, 4)->default(0);
            $table->timestamps();
            $table->index(['source_type', 'source_id']);
            $table->index('stock_layer_id');
        });

        Schema::table('grns', function (Blueprint $table) {
            $table->timestamp('stock_posted_at')->nullable();
        });
        DB::table('grns')->update(['stock_posted_at' => DB::raw('COALESCE(created_at, NOW())')]);

        $today = now()->toDateString();
        DB::table('items')->where('qty', '>', 0)->orderBy('id')->chunkById(500, function ($items) use ($today) {
            $rows = [];
            foreach ($items as $it) {
                $rows[] = [
                    'item_id' => $it->id,
                    'source_type' => 'opening',
                    'source_id' => null,
                    'date' => $today,
                    'qty_in' => (int) $it->qty,
                    'qty_left' => (int) $it->qty,
                    'unit_cost' => (float) $it->fifo_cost > 0 ? (float) $it->fifo_cost : (float) $it->avg_cost,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }
            DB::table('stock_layers')->insert($rows);
        });
    }

    public function down()
    {
        Schema::table('grns', function (Blueprint $table) {
            $table->dropColumn('stock_posted_at');
        });
        Schema::dropIfExists('stock_layer_moves');
        Schema::dropIfExists('stock_layers');
    }
}
