<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PurchaseOrder;
use App\Models\Shipment;
use App\Support\Costing;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ShipmentController extends Controller
{
    public function index(Request $request)
    {
        $q = Shipment::with(['lines'])->orderByDesc('id');
        if ($request->filled('po')) {
            $q->where('po_code', $request->get('po'));
        }

        return $q->get();
    }

    public function show(Shipment $shipment)
    {
        return $shipment->load(['lines', 'purchaseOrder.lines']);
    }

    /**
     * Create a shipment (costing) against a PO.
     * Payload mirrors the Costing screen: shipping/weight, rates, tax & custom
     * fields, simple charge amounts, complex charges (freight/insurance/banking/
     * clearance/slpa/demurrage) and the per-line item grid. All allocation is
     * done server-side in App\Support\Costing for a single source of truth.
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'po' => 'required|string',
            'date' => 'nullable|date',
            'invoice_no' => 'nullable|string',
            'bl_number' => 'nullable|string',
            'no_of_packages' => 'nullable|integer',
            'gross_weight' => 'nullable|numeric',
            'net_weight' => 'nullable|numeric',
            'shipment_type' => 'nullable|string',
            'shipment_volume' => 'nullable|string',
            'etd' => 'nullable|date',
            'eta_date' => 'nullable|date',
            'vessel' => 'nullable|string',
            'eta' => 'nullable|string',

            'cusdec_no' => 'nullable|string',
            'cusdec_date' => 'nullable|date',
            'banking_rate' => 'nullable|numeric',
            'custom_rate' => 'nullable|numeric',
            'settlement_rate' => 'nullable|numeric',

            'cid_amount' => 'nullable|numeric',
            'pal_amount' => 'nullable|numeric',
            'duty_amount' => 'nullable|numeric',
            'duty_date' => 'nullable|date',
            'cess_amount' => 'nullable|numeric',
            'vat_amount' => 'nullable|numeric',
            'sscl_amount' => 'nullable|numeric',
            'other1_amount' => 'nullable|numeric',
            'other2_amount' => 'nullable|numeric',
            'other3_amount' => 'nullable|numeric',

            'freight' => 'nullable|array',
            'insurance' => 'nullable|array',
            'banking' => 'nullable|array',
            'clearance' => 'nullable|array',
            'slpa' => 'nullable|array',
            'demurrage' => 'nullable|array',

            'cost_file_name' => 'nullable|string',
            'cost_file_data' => 'nullable|string',

            'lines' => 'required|array|min:1',
            'lines.*.code' => 'nullable|string',
            'lines.*.hs_code' => 'nullable|string',
            'lines.*.item' => 'required|string',
            'lines.*.qty' => 'required|numeric|min:0',
            'lines.*.cost' => 'required|numeric',
            'lines.*.selling_price_wo_vat' => 'nullable|numeric',
            'lines.*.selling_price_with_vat' => 'nullable|numeric',
        ]);

        return DB::transaction(function () use ($data) {
            $po = PurchaseOrder::where('code', $data['po'])->firstOrFail();
            $seq = $po->shipments()->count() + 1;
            $code = $po->code . '-S' . $seq;

            // Link lines to PO lines by code (fallback by item name).
            $poLines = $po->lines()->get()->keyBy(fn ($l) => $l->code ?: $l->item);
            $linesPayload = [];
            foreach ($data['lines'] as $l) {
                $key = ($l['code'] ?? '') ?: $l['item'];
                $poLine = $poLines->get($key);
                $linesPayload[] = array_merge($l, [
                    'purchase_order_line_id' => $poLine?->id,
                    'hs_code' => $l['hs_code'] ?? ($poLine?->hs_code),
                ]);
            }

            $computed = Costing::compute([
                'banking_rate' => $data['banking_rate'] ?? 0,
                'freight' => $data['freight'] ?? null,
                'insurance' => $data['insurance'] ?? null,
                'banking' => $data['banking'] ?? null,
                'clearance' => $data['clearance'] ?? null,
                'slpa' => $data['slpa'] ?? null,
                'demurrage' => $data['demurrage'] ?? null,
                'cid_amount' => $data['cid_amount'] ?? 0,
                'pal_amount' => $data['pal_amount'] ?? 0,
                'duty_amount' => $data['duty_amount'] ?? 0,
                'cess_amount' => $data['cess_amount'] ?? 0,
                'vat_amount' => $data['vat_amount'] ?? 0,
                'sscl_amount' => $data['sscl_amount'] ?? 0,
                'other1_amount' => $data['other1_amount'] ?? 0,
                'other2_amount' => $data['other2_amount'] ?? 0,
                'other3_amount' => $data['other3_amount'] ?? 0,
                'lines' => $linesPayload,
            ]);

            $shipment = Shipment::create([
                'code' => $code,
                'purchase_order_id' => $po->id,
                'po_code' => $po->code,
                'seq' => $seq,
                'date' => $data['date'] ?? now()->toDateString(),
                'invoice_no' => $data['invoice_no'] ?? null,
                'bl_number' => $data['bl_number'] ?? null,
                'no_of_packages' => $data['no_of_packages'] ?? null,
                'gross_weight' => $data['gross_weight'] ?? null,
                'net_weight' => $data['net_weight'] ?? null,
                'shipment_type' => $data['shipment_type'] ?? null,
                'shipment_volume' => $data['shipment_volume'] ?? null,
                'etd' => $data['etd'] ?? null,
                'eta_date' => $data['eta_date'] ?? null,
                'vessel' => $data['vessel'] ?? null,
                'eta' => $data['eta'] ?? null,
                'cusdec_no' => $data['cusdec_no'] ?? null,
                'cusdec_date' => $data['cusdec_date'] ?? null,
                'banking_rate' => $data['banking_rate'] ?? 0,
                'custom_rate' => $data['custom_rate'] ?? 0,
                'settlement_rate' => $data['settlement_rate'] ?? 0,
                'cid_amount' => $data['cid_amount'] ?? 0,
                'pal_amount' => $data['pal_amount'] ?? 0,
                'duty_amount' => $data['duty_amount'] ?? 0,
                'duty_date' => $data['duty_date'] ?? null,
                'cess_amount' => $data['cess_amount'] ?? 0,
                'vat_amount' => $data['vat_amount'] ?? 0,
                'sscl_amount' => $data['sscl_amount'] ?? 0,
                'other1_amount' => $data['other1_amount'] ?? 0,
                'other2_amount' => $data['other2_amount'] ?? 0,
                'other3_amount' => $data['other3_amount'] ?? 0,
                'freight' => $data['freight'] ?? null,
                'insurance' => $data['insurance'] ?? null,
                'banking' => $data['banking'] ?? null,
                'clearance' => $data['clearance'] ?? null,
                'slpa' => $data['slpa'] ?? null,
                'demurrage' => $data['demurrage'] ?? null,
                'cost_file_name' => $data['cost_file_name'] ?? null,
                'cost_file_data' => $data['cost_file_data'] ?? null,
                'items_total' => $computed['items_total_lkr'],
                'extras_total' => $computed['charges_total_lkr'],
                'landed_total' => $computed['landed_total'],
                'items_total_usd' => $computed['items_total_usd'],
                'items_total_lkr' => $computed['items_total_lkr'],
                'charges_total_lkr' => $computed['charges_total_lkr'],
                'status' => 'Costed',
            ]);

            foreach ($computed['lines'] as $cl) {
                $shipment->lines()->create($cl);
            }

            return response()->json($shipment->load('lines'), 201);
        });
    }

    public function destroy(Shipment $shipment)
    {
        $shipment->delete();

        return response()->noContent();
    }
}
