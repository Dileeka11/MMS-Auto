<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Grn;
use App\Models\Item;
use App\Models\PurchaseOrder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GrnController extends Controller
{
    public function index()
    {
        return Grn::orderByDesc('id')->get();
    }

    /**
     * Post a GRN against a PO. Each received line increases the item's
     * stock and recalculates its weighted-average cost:
     *   newAvg = (oldQty*oldAvg + recvQty*recvCost) / (oldQty + recvQty)
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'po' => 'required|string',
            'lines' => 'required|array|min:1',
            'lines.*.code' => 'nullable|string',
            'lines.*.qty' => 'required|integer|min:0',
            'lines.*.cost' => 'required|numeric',
        ]);

        return DB::transaction(function () use ($data) {
            $po = PurchaseOrder::where('code', $data['po'])->first();
            $total = 0;
            foreach ($data['lines'] as $l) {
                $recv = (int) $l['qty'];
                if ($recv <= 0) {
                    continue;
                }
                $total += $recv * $l['cost'];
                if (! empty($l['code'])) {
                    $item = Item::where('code', $l['code'])->first();
                    if ($item) {
                        $oldQty = $item->qty;
                        $newQty = $oldQty + $recv;
                        $item->avg_cost = $newQty > 0
                            ? round(($oldQty * $item->avg_cost + $recv * $l['cost']) / $newQty, 2)
                            : $item->avg_cost;
                        $item->qty = $newQty;
                        $item->status = $newQty <= 0 ? 'out' : ($newQty <= $item->reorder ? 'low' : 'in');
                        $item->save();
                    }
                }
            }
            $grn = Grn::create([
                'code' => 'GRN-' . (7700 + Grn::count() + 1),
                'po' => $data['po'],
                'supplier' => $po->supplier ?? '',
                'date' => now()->toDateString(),
                'items' => count($data['lines']),
                'total' => $total,
                'status' => 'Posted',
            ]);
            if ($po) {
                $po->update(['status' => 'Completed']);
            }

            return response()->json($grn, 201);
        });
    }

    public function destroy(Grn $grn)
    {
        $grn->delete();

        return response()->noContent();
    }
}
