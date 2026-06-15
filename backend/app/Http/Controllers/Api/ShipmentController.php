<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PurchaseOrder;
use App\Models\Shipment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ShipmentController extends Controller
{
    public function index(Request $request)
    {
        $q = Shipment::with(['lines', 'extras'])->orderByDesc('id');
        if ($request->filled('po')) {
            $q->where('po_code', $request->get('po'));
        }

        return $q->get();
    }

    public function show(Shipment $shipment)
    {
        return $shipment->load(['lines', 'extras', 'purchaseOrder.lines']);
    }

    /**
     * Create a shipment (costing) against a PO. Lines come from the costing
     * Excel — usually the same item list as the PO with quantities & unit cost,
     * plus a list of extras (freight/duty/etc.) that get spread proportionally
     * to give each line a landed_cost.
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'po' => 'required|string',
            'date' => 'nullable|date',
            'vessel' => 'nullable|string',
            'bl_number' => 'nullable|string',
            'eta' => 'nullable|string',
            'cost_file_name' => 'nullable|string',
            'cost_file_data' => 'nullable|string',
            'lines' => 'required|array|min:1',
            'lines.*.code' => 'nullable|string',
            'lines.*.item' => 'required|string',
            'lines.*.qty' => 'required|numeric|min:0',
            'lines.*.cost' => 'required|numeric',
            'extras' => 'nullable|array',
            'extras.*.label' => 'required_with:extras|string',
            'extras.*.amount' => 'required_with:extras|numeric',
        ]);

        return DB::transaction(function () use ($data) {
            $po = PurchaseOrder::where('code', $data['po'])->firstOrFail();
            $seq = $po->shipments()->count() + 1;
            $code = $po->code . '-S' . $seq;

            $itemsTotal = collect($data['lines'])->sum(fn ($l) => (int) $l['qty'] * (float) $l['cost']);
            $extrasTotal = collect($data['extras'] ?? [])->sum(fn ($e) => (float) $e['amount']);
            $landedTotal = $itemsTotal + $extrasTotal;
            $ratio = $itemsTotal > 0 ? $landedTotal / $itemsTotal : 1.0;

            $shipment = Shipment::create([
                'code' => $code,
                'purchase_order_id' => $po->id,
                'po_code' => $po->code,
                'seq' => $seq,
                'date' => $data['date'] ?? now()->toDateString(),
                'vessel' => $data['vessel'] ?? null,
                'bl_number' => $data['bl_number'] ?? null,
                'eta' => $data['eta'] ?? null,
                'cost_file_name' => $data['cost_file_name'] ?? null,
                'cost_file_data' => $data['cost_file_data'] ?? null,
                'items_total' => $itemsTotal,
                'extras_total' => $extrasTotal,
                'landed_total' => $landedTotal,
                'status' => 'Costed',
            ]);

            // Match PO lines by code (fallback by item name) to link shipment lines
            $poLines = $po->lines()->get()->keyBy(fn ($l) => $l->code ?: $l->item);

            foreach ($data['lines'] as $l) {
                $key = $l['code'] ?: $l['item'];
                $poLine = $poLines->get($key);
                $qty = (int) $l['qty'];
                $unit = (float) $l['cost'];
                $lineTotal = $qty * $unit;
                $landedUnit = round($unit * $ratio, 2);

                $shipment->lines()->create([
                    'purchase_order_line_id' => $poLine?->id,
                    'code' => $l['code'] ?? null,
                    'item' => $l['item'],
                    'qty' => $qty,
                    'cost' => $unit,
                    'total' => $lineTotal,
                    'landed_cost' => $landedUnit,
                    'landed_total' => round($landedUnit * $qty, 2),
                ]);
            }

            foreach (($data['extras'] ?? []) as $e) {
                $shipment->extras()->create([
                    'label' => $e['label'],
                    'amount' => $e['amount'],
                ]);
            }

            return response()->json($shipment->load(['lines', 'extras']), 201);
        });
    }

    public function destroy(Shipment $shipment)
    {
        $shipment->delete();

        return response()->noContent();
    }
}
