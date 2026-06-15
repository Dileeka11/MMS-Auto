<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Grn;
use App\Models\Item;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderLine;
use App\Models\Shipment;
use App\Models\ShipmentLine;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GrnController extends Controller
{
    public function index()
    {
        return Grn::with('lines')->orderByDesc('id')->get();
    }

    /**
     * Post a GRN against a PO + Shipment. Each received line:
     *  - increases the matched item's stock
     *  - recalculates weighted-average cost using the LANDED cost
     *  - decrements the PO line's balance_qty / increments received_qty
     * If every PO line is fully received the PO is marked Completed,
     * otherwise it moves to Partial GRN.
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'po' => 'required|string',
            'shipment_code' => 'required|string',
            'date' => 'nullable|date',
            'lines' => 'required|array|min:1',
            'lines.*.shipment_line_id' => 'nullable|integer',
            'lines.*.code' => 'nullable|string',
            'lines.*.item' => 'required|string',
            'lines.*.qty' => 'required|integer|min:0',
            'lines.*.cost' => 'required|numeric',
        ]);

        return DB::transaction(function () use ($data) {
            $po = PurchaseOrder::where('code', $data['po'])->firstOrFail();
            $shipment = Shipment::where('code', $data['shipment_code'])->firstOrFail();

            $grn = Grn::create([
                'code' => 'GRN-' . (7700 + Grn::count() + 1),
                'po' => $po->code,
                'shipment_code' => $shipment->code,
                'shipment_id' => $shipment->id,
                'supplier' => $po->supplier,
                'date' => $data['date'] ?? now()->toDateString(),
                'items' => 0,
                'total' => 0,
                'status' => 'Posted',
            ]);

            $total = 0;
            $linesPosted = 0;

            foreach ($data['lines'] as $l) {
                $recv = (int) $l['qty'];
                if ($recv <= 0) {
                    continue;
                }
                $unit = (float) $l['cost'];
                $total += $recv * $unit;
                $linesPosted++;

                $grn->lines()->create([
                    'shipment_line_id' => $l['shipment_line_id'] ?? null,
                    'code' => $l['code'] ?? null,
                    'item' => $l['item'],
                    'qty' => $recv,
                    'cost' => $unit,
                    'total' => $recv * $unit,
                ]);

                // Decrement PO line balance via the shipment line linkage
                if (! empty($l['shipment_line_id'])) {
                    $sl = ShipmentLine::find($l['shipment_line_id']);
                    if ($sl && $sl->purchase_order_line_id) {
                        $pl = PurchaseOrderLine::find($sl->purchase_order_line_id);
                        if ($pl) {
                            $take = min($recv, $pl->balance_qty);
                            $pl->balance_qty = max(0, $pl->balance_qty - $take);
                            $pl->received_qty = $pl->received_qty + $take;
                            $pl->save();
                        }
                    }
                }

                // Stock + weighted-average cost using landed cost
                if (! empty($l['code'])) {
                    $item = Item::where('code', $l['code'])->first();
                    if ($item) {
                        $oldQty = $item->qty;
                        $newQty = $oldQty + $recv;
                        $item->avg_cost = $newQty > 0
                            ? round(($oldQty * $item->avg_cost + $recv * $unit) / $newQty, 2)
                            : $item->avg_cost;
                        $item->qty = $newQty;
                        $item->status = $newQty <= 0 ? 'out' : ($newQty <= $item->reorder ? 'low' : 'in');
                        $item->save();
                    }
                }
            }

            $grn->update(['items' => $linesPosted, 'total' => $total]);

            // Recompute PO status from balance
            $totalBalance = $po->lines()->sum('balance_qty');
            $totalReceived = $po->lines()->sum('received_qty');
            if ($totalBalance <= 0) {
                $po->update(['status' => 'Completed']);
            } elseif ($totalReceived > 0) {
                $po->update(['status' => 'Partial GRN']);
            }

            // Shipment status
            $shipBalance = $shipment->lines()->get()->sum(function ($sl) {
                return $sl->purchaseOrderLine?->balance_qty ?? 0;
            });
            $shipment->update(['status' => $shipBalance <= 0 ? 'Received' : 'Partially Received']);

            return response()->json($grn->load('lines'), 201);
        });
    }

    public function destroy(Grn $grn)
    {
        $grn->delete();

        return response()->noContent();
    }
}
