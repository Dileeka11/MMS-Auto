<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\HandlesApprovals;
use App\Http\Controllers\Controller;
use App\Models\PurchaseOrder;
use App\Models\Shipment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ShipmentController extends Controller
{
    use HandlesApprovals;

    public function index(Request $request)
    {
        $q = Shipment::with(['lines', 'approver1:id,name', 'approver2:id,name', 'rejectedBy:id,name'])->orderByDesc('id');
        if ($request->filled('po')) {
            $q->where('po_code', $request->get('po'));
        }

        return $q->get();
    }

    public function show(Shipment $shipment)
    {
        return $shipment->load(['lines', 'purchaseOrder.lines', 'approver1:id,name', 'approver2:id,name', 'rejectedBy:id,name']);
    }

    public function approve(Request $request, Shipment $shipment)
    {
        return $this->performApprove($request, $shipment, 'shipment')
            ->load(['lines', 'approver1:id,name', 'approver2:id,name']);
    }

    public function reject(Request $request, Shipment $shipment)
    {
        return $this->performReject($request, $shipment, 'shipment')
            ->load(['lines', 'rejectedBy:id,name']);
    }

    /**
     * Create a shipment (costing) against a PO.
     * Payload mirrors the Costing screen: shipping/weight, rates, tax & custom
     * fields, simple charge amounts, complex charges (freight/insurance/banking/
     * clearance/slpa/demurrage) and the per-line item grid. The per-line
     * allocation columns are taken VERBATIM from the uploaded costing Excel —
     * no server-side recomputation; totals are sums of the line values.
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
            // Verbatim allocation columns from the uploaded costing Excel.
            'lines.*.total' => 'nullable|numeric',
            'lines.*.fob_lkr' => 'nullable|numeric',
            'lines.*.freight_lkr' => 'nullable|numeric',
            'lines.*.insurance_lkr' => 'nullable|numeric',
            'lines.*.cid' => 'nullable|numeric',
            'lines.*.pal' => 'nullable|numeric',
            'lines.*.cess' => 'nullable|numeric',
            'lines.*.vat' => 'nullable|numeric',
            'lines.*.sscl' => 'nullable|numeric',
            'lines.*.duty' => 'nullable|numeric',
            'lines.*.other1' => 'nullable|numeric',
            'lines.*.other2' => 'nullable|numeric',
            'lines.*.other3' => 'nullable|numeric',
            'lines.*.banking_alloc' => 'nullable|numeric',
            'lines.*.clearance_alloc' => 'nullable|numeric',
            'lines.*.slpa_alloc' => 'nullable|numeric',
            'lines.*.demurrage_alloc' => 'nullable|numeric',
            'lines.*.total_price_wo_vat' => 'nullable|numeric',
            'lines.*.total_price_with_vat' => 'nullable|numeric',
            'lines.*.unit_cost_wo_vat' => 'nullable|numeric',
            'lines.*.unit_cost_with_vat' => 'nullable|numeric',
            'lines.*.selling_price_wo_vat' => 'nullable|numeric',
            'lines.*.selling_price_with_vat' => 'nullable|numeric',
        ]);

        return DB::transaction(function () use ($data) {
            $po = PurchaseOrder::where('code', $data['po'])->firstOrFail();

            if (!$po->isFullyApproved()) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'po' => 'This PO is not fully approved yet. Two admin approvals are required before costing.',
                ]);
            }

            $seq = $po->shipments()->count() + 1;
            $code = $po->code . '-S' . $seq;

            // Link lines to PO lines by code (fallback by item name).
            $poLines = $po->lines()->get()->keyBy(fn ($l) => $l->code ?: $l->item);

            // Store the uploaded costing values VERBATIM — no recomputation. The
            // shipment totals are simple sums of the per-line Excel columns
            // (mirroring the template's GRAND TOTAL row).
            $n = fn ($v) => (float) ($v ?? 0);
            $computedLines = [];
            $itemsTotalUsd = 0.0;
            $itemsTotalLkr = 0.0;
            $landedTotal = 0.0;
            foreach ($data['lines'] as $l) {
                $key = ($l['code'] ?? '') ?: $l['item'];
                $poLine = $poLines->get($key);
                $qty = $n($l['qty'] ?? null);
                $unit = $n($l['cost'] ?? null);
                $totalUsd = $n($l['total'] ?? null) ?: round($qty * $unit, 2);
                $fobLkr = $n($l['fob_lkr'] ?? null);
                $charges = $n($l['freight_lkr'] ?? null) + $n($l['insurance_lkr'] ?? null)
                    + $n($l['cid'] ?? null) + $n($l['pal'] ?? null) + $n($l['cess'] ?? null)
                    + $n($l['vat'] ?? null) + $n($l['sscl'] ?? null) + $n($l['duty'] ?? null)
                    + $n($l['other1'] ?? null) + $n($l['other2'] ?? null) + $n($l['other3'] ?? null)
                    + $n($l['banking_alloc'] ?? null) + $n($l['clearance_alloc'] ?? null)
                    + $n($l['slpa_alloc'] ?? null) + $n($l['demurrage_alloc'] ?? null);
                $totalWithVat = $n($l['total_price_with_vat'] ?? null) ?: round($fobLkr + $charges, 2);
                $totalWoVat = $n($l['total_price_wo_vat'] ?? null) ?: round($fobLkr + $charges - $n($l['vat'] ?? null), 2);

                $itemsTotalUsd += $totalUsd;
                $itemsTotalLkr += $fobLkr;
                $landedTotal += $totalWithVat;

                $computedLines[] = [
                    'code' => $l['code'] ?? null,
                    'hs_code' => $l['hs_code'] ?? optional($poLine)->hs_code,
                    'item' => $l['item'] ?? '',
                    'purchase_order_line_id' => optional($poLine)->id,
                    'qty' => $qty,
                    'cost' => $unit,
                    'total' => $totalUsd,
                    'fob_lkr' => $fobLkr,
                    'freight_lkr' => $n($l['freight_lkr'] ?? null),
                    'insurance_lkr' => $n($l['insurance_lkr'] ?? null),
                    'cid' => $n($l['cid'] ?? null),
                    'pal' => $n($l['pal'] ?? null),
                    'cess' => $n($l['cess'] ?? null),
                    'vat' => $n($l['vat'] ?? null),
                    'sscl' => $n($l['sscl'] ?? null),
                    'duty' => $n($l['duty'] ?? null),
                    'other1' => $n($l['other1'] ?? null),
                    'other2' => $n($l['other2'] ?? null),
                    'other3' => $n($l['other3'] ?? null),
                    'banking_alloc' => $n($l['banking_alloc'] ?? null),
                    'clearance_alloc' => $n($l['clearance_alloc'] ?? null),
                    'slpa_alloc' => $n($l['slpa_alloc'] ?? null),
                    'demurrage_alloc' => $n($l['demurrage_alloc'] ?? null),
                    'total_price_wo_vat' => $totalWoVat,
                    'total_price_with_vat' => $totalWithVat,
                    'unit_cost_wo_vat' => $n($l['unit_cost_wo_vat'] ?? null),
                    'unit_cost_with_vat' => $n($l['unit_cost_with_vat'] ?? null),
                    'selling_price_wo_vat' => $n($l['selling_price_wo_vat'] ?? null),
                    'selling_price_with_vat' => $n($l['selling_price_with_vat'] ?? null),
                    'landed_cost' => $n($l['unit_cost_with_vat'] ?? null),
                    'landed_total' => $totalWithVat,
                ];
            }

            $computed = [
                'items_total_usd' => round($itemsTotalUsd, 2),
                'items_total_lkr' => round($itemsTotalLkr, 2),
                'charges_total_lkr' => round($landedTotal - $itemsTotalLkr, 2),
                'landed_total' => round($landedTotal, 2),
                'lines' => $computedLines,
            ];

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
                'status' => 'Awaiting Approval',
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
