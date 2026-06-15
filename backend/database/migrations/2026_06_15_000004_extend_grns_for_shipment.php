<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class ExtendGrnsForShipment extends Migration
{
    public function up()
    {
        Schema::table('grns', function (Blueprint $table) {
            $table->string('shipment_code')->nullable()->after('po');
            $table->foreignId('shipment_id')->nullable()->after('shipment_code')->constrained()->nullOnDelete();
        });

        Schema::create('grn_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('grn_id')->constrained()->cascadeOnDelete();
            $table->foreignId('shipment_line_id')->nullable()->constrained()->nullOnDelete();
            $table->string('code')->nullable();
            $table->string('item');
            $table->integer('qty')->default(0);
            $table->decimal('cost', 14, 2)->default(0);
            $table->decimal('total', 14, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('grn_lines');
        Schema::table('grns', function (Blueprint $table) {
            $table->dropConstrainedForeignId('shipment_id');
            $table->dropColumn('shipment_code');
        });
    }
}
