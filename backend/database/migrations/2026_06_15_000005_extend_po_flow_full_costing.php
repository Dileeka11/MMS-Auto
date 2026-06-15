<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class ExtendPoFlowFullCosting extends Migration
{
    public function up()
    {
        Schema::table('purchase_order_lines', function (Blueprint $table) {
            $table->string('hs_code', 32)->nullable()->after('item');
        });

        Schema::table('shipments', function (Blueprint $table) {
            $table->string('invoice_no')->nullable()->after('seq');
            $table->integer('no_of_packages')->nullable()->after('invoice_no');
            $table->decimal('gross_weight', 14, 3)->nullable()->after('no_of_packages');
            $table->decimal('net_weight', 14, 3)->nullable()->after('gross_weight');
            $table->string('shipment_type', 16)->nullable()->after('net_weight');
            $table->string('shipment_volume', 16)->nullable()->after('shipment_type');
            $table->date('etd')->nullable()->after('shipment_volume');
            $table->date('eta_date')->nullable()->after('etd');
            $table->string('cusdec_no')->nullable()->after('eta_date');
            $table->date('cusdec_date')->nullable()->after('cusdec_no');

            $table->decimal('banking_rate', 14, 4)->default(0)->after('cusdec_date');
            $table->decimal('custom_rate', 14, 4)->default(0)->after('banking_rate');
            $table->decimal('settlement_rate', 14, 4)->default(0)->after('custom_rate');

            $table->decimal('cid_amount', 14, 2)->default(0)->after('settlement_rate');
            $table->decimal('pal_amount', 14, 2)->default(0)->after('cid_amount');
            $table->decimal('duty_amount', 14, 2)->default(0)->after('pal_amount');
            $table->date('duty_date')->nullable()->after('duty_amount');
            $table->decimal('cess_amount', 14, 2)->default(0)->after('duty_date');
            $table->decimal('vat_amount', 14, 2)->default(0)->after('cess_amount');
            $table->decimal('sscl_amount', 14, 2)->default(0)->after('vat_amount');
            $table->decimal('other1_amount', 14, 2)->default(0)->after('sscl_amount');
            $table->decimal('other2_amount', 14, 2)->default(0)->after('other1_amount');
            $table->decimal('other3_amount', 14, 2)->default(0)->after('other2_amount');

            // Complex charges as JSON: {amount_usd, amount_lkr, agent, invoice_no, policy_no, invoice_value}
            $table->json('freight')->nullable()->after('other3_amount');
            $table->json('insurance')->nullable()->after('freight');
            $table->json('banking')->nullable()->after('insurance');
            $table->json('clearance')->nullable()->after('banking');
            $table->json('slpa')->nullable()->after('clearance');
            $table->json('demurrage')->nullable()->after('slpa');

            $table->decimal('items_total_usd', 14, 2)->default(0)->after('demurrage');
            $table->decimal('items_total_lkr', 14, 2)->default(0)->after('items_total_usd');
            $table->decimal('charges_total_lkr', 14, 2)->default(0)->after('items_total_lkr');
        });

        Schema::table('shipment_lines', function (Blueprint $table) {
            $table->string('hs_code', 32)->nullable()->after('item');

            $table->decimal('fob_lkr', 14, 2)->default(0)->after('total');
            $table->decimal('freight_lkr', 14, 2)->default(0)->after('fob_lkr');
            $table->decimal('insurance_lkr', 14, 2)->default(0)->after('freight_lkr');
            $table->decimal('cid', 14, 2)->default(0)->after('insurance_lkr');
            $table->decimal('pal', 14, 2)->default(0)->after('cid');
            $table->decimal('cess', 14, 2)->default(0)->after('pal');
            $table->decimal('vat', 14, 2)->default(0)->after('cess');
            $table->decimal('sscl', 14, 2)->default(0)->after('vat');
            $table->decimal('duty', 14, 2)->default(0)->after('sscl');
            $table->decimal('other1', 14, 2)->default(0)->after('duty');
            $table->decimal('other2', 14, 2)->default(0)->after('other1');
            $table->decimal('other3', 14, 2)->default(0)->after('other2');
            $table->decimal('banking_alloc', 14, 2)->default(0)->after('other3');
            $table->decimal('clearance_alloc', 14, 2)->default(0)->after('banking_alloc');
            $table->decimal('slpa_alloc', 14, 2)->default(0)->after('clearance_alloc');
            $table->decimal('demurrage_alloc', 14, 2)->default(0)->after('slpa_alloc');

            $table->decimal('total_price_wo_vat', 14, 2)->default(0)->after('demurrage_alloc');
            $table->decimal('total_price_with_vat', 14, 2)->default(0)->after('total_price_wo_vat');
            $table->decimal('unit_cost_wo_vat', 14, 4)->default(0)->after('total_price_with_vat');
            $table->decimal('unit_cost_with_vat', 14, 4)->default(0)->after('unit_cost_wo_vat');
            $table->decimal('selling_price_wo_vat', 14, 2)->default(0)->after('unit_cost_with_vat');
            $table->decimal('selling_price_with_vat', 14, 2)->default(0)->after('selling_price_wo_vat');
        });

        Schema::table('grn_lines', function (Blueprint $table) {
            $table->decimal('unit_cost_wo_vat', 14, 4)->default(0)->after('total');
            $table->decimal('unit_cost_with_vat', 14, 4)->default(0)->after('unit_cost_wo_vat');
            $table->decimal('selling_price_wo_vat', 14, 2)->default(0)->after('unit_cost_with_vat');
            $table->decimal('selling_price_with_vat', 14, 2)->default(0)->after('selling_price_wo_vat');
        });

        Schema::table('items', function (Blueprint $table) {
            $table->string('hs_code', 32)->nullable()->after('group');
            $table->decimal('selling_price_wo_vat', 14, 2)->default(0)->after('price');
            $table->decimal('selling_price_with_vat', 14, 2)->default(0)->after('selling_price_wo_vat');
        });
    }

    public function down()
    {
        Schema::table('items', function (Blueprint $table) {
            $table->dropColumn(['hs_code', 'selling_price_wo_vat', 'selling_price_with_vat']);
        });

        Schema::table('grn_lines', function (Blueprint $table) {
            $table->dropColumn([
                'unit_cost_wo_vat', 'unit_cost_with_vat',
                'selling_price_wo_vat', 'selling_price_with_vat',
            ]);
        });

        Schema::table('shipment_lines', function (Blueprint $table) {
            $table->dropColumn([
                'hs_code', 'fob_lkr', 'freight_lkr', 'insurance_lkr',
                'cid', 'pal', 'cess', 'vat', 'sscl', 'duty',
                'other1', 'other2', 'other3',
                'banking_alloc', 'clearance_alloc', 'slpa_alloc', 'demurrage_alloc',
                'total_price_wo_vat', 'total_price_with_vat',
                'unit_cost_wo_vat', 'unit_cost_with_vat',
                'selling_price_wo_vat', 'selling_price_with_vat',
            ]);
        });

        Schema::table('shipments', function (Blueprint $table) {
            $table->dropColumn([
                'invoice_no', 'no_of_packages', 'gross_weight', 'net_weight',
                'shipment_type', 'shipment_volume', 'etd', 'eta_date',
                'cusdec_no', 'cusdec_date',
                'banking_rate', 'custom_rate', 'settlement_rate',
                'cid_amount', 'pal_amount', 'duty_amount', 'duty_date',
                'cess_amount', 'vat_amount', 'sscl_amount',
                'other1_amount', 'other2_amount', 'other3_amount',
                'freight', 'insurance', 'banking', 'clearance', 'slpa', 'demurrage',
                'items_total_usd', 'items_total_lkr', 'charges_total_lkr',
            ]);
        });

        Schema::table('purchase_order_lines', function (Blueprint $table) {
            $table->dropColumn('hs_code');
        });
    }
}
