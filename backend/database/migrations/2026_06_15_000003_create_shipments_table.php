<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateShipmentsTable extends Migration
{
    public function up()
    {
        Schema::create('shipments', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();                         // e.g. PO-4500-S1
            $table->foreignId('purchase_order_id')->constrained()->cascadeOnDelete();
            $table->string('po_code');                                // denormalised
            $table->integer('seq')->default(1);                       // 1,2,3 per PO
            $table->date('date');
            $table->string('vessel')->nullable();
            $table->string('bl_number')->nullable();
            $table->string('eta')->nullable();
            $table->string('status', 24)->default('Costed');          // Costed | Partially Received | Received
            $table->decimal('items_total', 14, 2)->default(0);
            $table->decimal('extras_total', 14, 2)->default(0);
            $table->decimal('landed_total', 14, 2)->default(0);
            $table->string('cost_file_name')->nullable();
            $table->longText('cost_file_data')->nullable();           // base64-encoded original xlsx
            $table->timestamps();
        });

        Schema::create('shipment_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shipment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('purchase_order_line_id')->nullable()->constrained()->nullOnDelete();
            $table->string('code')->nullable();
            $table->string('item');
            $table->integer('qty')->default(0);
            $table->decimal('cost', 14, 2)->default(0);              // unit cost from PO
            $table->decimal('total', 14, 2)->default(0);             // qty * cost
            $table->decimal('landed_cost', 14, 2)->default(0);       // per-unit incl. extras
            $table->decimal('landed_total', 14, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('shipment_extras', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shipment_id')->constrained()->cascadeOnDelete();
            $table->string('label');                                  // Freight, Duty, VAT, etc.
            $table->decimal('amount', 14, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('shipment_extras');
        Schema::dropIfExists('shipment_lines');
        Schema::dropIfExists('shipments');
    }
}
