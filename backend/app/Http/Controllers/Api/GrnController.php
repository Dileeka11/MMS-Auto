<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\HandlesApprovals;
use App\Http\Controllers\Controller;
use App\Models\Grn;
use App\Models\GrnLine;
use App\Models\Item;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderLine;
use App\Models\Shipment;
use App\Models\ShipmentLine;
use App\Services\Accounting\Posting;
use App\Support\Fifo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Goods received notes.
 *
 * Saving a GRN only records what arrived (status "Awaiting Approval"). Stock,
 * costs, selling prices, PO balances and the journal move on the SECOND admin
 * approval — see receive(). A rejected GRN never touches stock.
 */
class GrnController extends Controller
{
    use HandlesApprovals;

    public function index()
    {
        return Grn::with(['lines', 'approver1:id,name', 'approver2:id,name', 'rejectedBy:id,name'])
            ->orderByDesc('id')->get();
    }

    /** Second approval receives the goods into stock and posts the journal. */
    public function approve(Request $request, Grn $grn)
    {
        return DB::transaction(function () use ($request, $grn) {
            $grn = Grn::whereKey($grn->id)->lockForUpdate()->firstOrFail();
            $grn = $this->performApprove($request, $grn, 'grn');
            if ($grn->isFullyApproved() && ! $grn->stock_posted_at) {
                $this->receive($grn);
            }

            return $grn->fresh()->load(['lines', 'approver1:id,name', 'approver2:id,name']);
        });
    }

    public function reject(Request $request, Grn $grn)
    {
        return $this->performReject($request, $grn, 'grn')
            ->load(['lines', 'rejectedBy:id,name']);
    }

    /**
     * Record a GRN against an approved PO + Shipment. Nothing moves yet — the
     * quantities are only checked against what the PO still owes (less what
     * other GRNs awaiting approval already claim).
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
            'lines.*.unit_cost_wo_vat' => 'nullable|numeric',
            'lines.*.unit_cost_with_vat' => 'nullable|numeric',
            'lines.*.selling_price_wo_vat' => 'nullable|numeric',
            'lines.*.selling_price_with_vat' => 'nullable|numeric',
        ]);

        return DB::transaction(function () use ($data) {
            $po = PurchaseOrder::where('code', $data['po'])->firstOrFail();
            if (! $po->isFullyApproved()) {
                throw ValidationException::withMessages([
                    'po' => 'This PO is not fully approved yet. Two admin approvals are required before GRN.',
                ]);
            }
            $shipment = Shipment::where('code', $data['shipment_code'])->firstOrFail();
            if (! $shipment->isFullyApproved()) {
                throw ValidationException::withMessages([
                    'shipment_code' => 'This shipment (costing) is not fully approved yet. Two admin approvals are required before GRN.',
                ]);
            }

            $pending = $this->pendingByPoLine($po->code);
            $claim = [];
            foreach ($data['lines'] as $l) {
                $pl = $this->poLineFor($l['shipment_line_id'] ?? null);
                if (! $pl || (int) $l['qty'] <= 0) {
                    continue;
                }
                $claim[$pl->id] = ($claim[$pl->id] ?? 0) + (int) $l['qty'];
                $open = (int) $pl->balance_qty - ($pending[$pl->id] ?? 0);
                if ($claim[$pl->id] > $open) {
                    throw ValidationException::withMessages([
                        'lines' => "{$l['item']}: only " . max(0, $open) . " still to receive on {$po->code}"
                            . (($pending[$pl->id] ?? 0) > 0 ? " ({$pending[$pl->id]} more are on GRNs awaiting approval)" : '') . '.',
                    ]);
                }
            }

            $grn = Grn::create([
                'code' => Grn::nextCode(),
                'po' => $po->code,
                'shipment_code' => $shipment->code,
                'shipment_id' => $shipment->id,
                'supplier' => $po->supplier,
                'date' => $data['date'] ?? now()->toDateString(),
                'items' => 0,
                'total' => 0,
                'status' => 'Awaiting Approval',
            ]);

            $total = 0;
            $linesPosted = 0;
            foreach ($data['lines'] as $l) {
                $recv = (int) $l['qty'];
                if ($recv <= 0) {
                    continue;
                }
                $unitWithVat = (float) ($l['unit_cost_with_vat'] ?? $l['cost']);
                $total += $recv * $unitWithVat;
                $linesPosted++;
                $grn->lines()->create([
                    'shipment_line_id' => $l['shipment_line_id'] ?? null,
                    'code' => $l['code'] ?? null,
                    'item' => $l['item'],
                    'qty' => $recv,
                    'cost' => $unitWithVat,
                    'total' => round($recv * $unitWithVat, 2),
                    'unit_cost_wo_vat' => (float) ($l['unit_cost_wo_vat'] ?? $l['cost']),
                    'unit_cost_with_vat' => $unitWithVat,
                    'selling_price_wo_vat' => (float) ($l['selling_price_wo_vat'] ?? 0),
                    'selling_price_with_vat' => (float) ($l['selling_price_with_vat'] ?? 0),
                ]);
            }
            if ($linesPosted === 0) {
                throw ValidationException::withMessages(['lines' => 'Enter a received quantity on at least one line.']);
            }

            $grn->update(['items' => $linesPosted, 'total' => round($total, 2)]);

            return response()->json($grn->load('lines'), 201);
        });
    }

    /**
     * Delete a GRN. One awaiting approval (or rejected) never moved stock, so
     * it just goes. A received one is undone: the stock comes back out
     * (re-weighting the avg cost and its FIFO layer), the PO lines are owed
     * again, PO and shipment statuses are recomputed, and the journal goes.
     * Refused when the goods have already been sold or moved on.
     */
    public function destroy(Grn $grn)
    {
        DB::transaction(function () use ($grn) {
            $grn->load('lines');

            if ($grn->stock_posted_at) {
                foreach ($grn->lines as $l) {
                    $item = $l->code ? Item::where('code', $l->code)->lockForUpdate()->first() : null;
                    if ($item) {
                        $left = Fifo::receivedLeft($item, Fifo::GRN, $l->id);
                        $onHand = $left === null ? (int) $item->qty : min($left, (int) $item->qty);
                        if ($onHand < $l->qty) {
                            throw ValidationException::withMessages([
                                'grn' => "Cannot delete: only {$onHand} of the {$l->qty} {$item->name} on this GRN are still in stock — the rest are sold or moved.",
                            ]);
                        }
                        $unit = (float) $l->unit_cost_wo_vat > 0 ? (float) $l->unit_cost_wo_vat : (float) $l->cost;
                        $item->removeStock((int) $l->qty, $unit);
                        Fifo::removeReceipt($item, Fifo::GRN, $l->id, (int) $l->qty);
                    }

                    $pl = $this->poLineFor($l->shipment_line_id);
                    if ($pl) {
                        $back = min((int) $l->qty, (int) $pl->received_qty);
                        $pl->received_qty = $pl->received_qty - $back;
                        $pl->balance_qty = $pl->balance_qty + $back;
                        $pl->save();
                    }
                }
            }

            Posting::remove(Posting::GRN, $grn->id);
            $grn->lines()->delete();
            $grn->delete();

            if ($grn->stock_posted_at) {
                $this->refreshStatuses($grn);
            }
        });

        return response()->noContent();
    }

    /**
     * Receive an approved GRN. Each line:
     *  - increases the matched item's stock and adds a FIFO layer at the
     *    landed ex-VAT cost
     *  - recalculates the weighted-average cost with that same cost
     *  - decrements the PO line's balance_qty / increments received_qty
     *  - updates the item's selling prices to the latest entered values
     * then posts the journal and recomputes PO / shipment status.
     */
    protected function receive(Grn $grn): void
    {
        $grn->load('lines');

        foreach ($grn->lines as $l) {
            $recv = (int) $l->qty;
            if ($recv <= 0) {
                continue;
            }

            $pl = $this->poLineFor($l->shipment_line_id);
            if ($pl) {
                $pl = PurchaseOrderLine::whereKey($pl->id)->lockForUpdate()->first();
                if ($recv > (int) $pl->balance_qty) {
                    throw ValidationException::withMessages([
                        'grn' => "{$l->item}: only {$pl->balance_qty} still to receive on {$grn->po}, this GRN has {$recv}. Reject it and raise a corrected GRN.",
                    ]);
                }
                $pl->balance_qty = (int) $pl->balance_qty - $recv;
                $pl->received_qty = (int) $pl->received_qty + $recv;
                $pl->save();
            }

            $item = $l->code ? Item::where('code', $l->code)->lockForUpdate()->first() : null;
            if (! $item) {
                continue;
            }
            $unitWoVat = (float) $l->unit_cost_wo_vat > 0 ? (float) $l->unit_cost_wo_vat : (float) $l->cost;
            $item->addStock($recv, $unitWoVat);
            if ((float) $l->selling_price_wo_vat > 0) {
                $item->selling_price_wo_vat = $l->selling_price_wo_vat;
                $item->price = $l->selling_price_wo_vat;
            }
            if ((float) $l->selling_price_with_vat > 0) {
                $item->selling_price_with_vat = $l->selling_price_with_vat;
            }
            $item->save();
            Fifo::receive($item, $recv, $unitWoVat, Fifo::GRN, $l->id, optional($grn->date)->toDateString());
        }

        $grn->stock_posted_at = now();
        $grn->save();
        Posting::grn($grn);

        $this->refreshStatuses($grn);
    }

    /** Recompute PO and shipment status from the PO line balances. */
    protected function refreshStatuses(Grn $grn): void
    {
        $po = PurchaseOrder::where('code', $grn->po)->first();
        if ($po) {
            $received = $po->lines()->sum('received_qty');
            $balance = $po->lines()->sum('balance_qty');
            $po->update(['status' => $received <= 0 ? 'Approved' : ($balance <= 0 ? 'Completed' : 'Partial GRN')]);
        }
        $shipment = $grn->shipment_id ? Shipment::find($grn->shipment_id) : null;
        if ($shipment) {
            $lines = $shipment->lines()->get();
            $received = $lines->sum(function ($sl) { return optional($sl->purchaseOrderLine)->received_qty ?? 0; });
            $balance = $lines->sum(function ($sl) { return optional($sl->purchaseOrderLine)->balance_qty ?? 0; });
            $shipment->update(['status' => $received <= 0 ? 'Approved' : ($balance <= 0 ? 'Received' : 'Partially Received')]);
        }
    }

    protected function poLineFor($shipmentLineId): ?PurchaseOrderLine
    {
        $sl = $shipmentLineId ? ShipmentLine::find($shipmentLineId) : null;

        return $sl && $sl->purchase_order_line_id ? PurchaseOrderLine::find($sl->purchase_order_line_id) : null;
    }

    /** Qty per PO line already claimed by this PO's GRNs that are still awaiting approval. */
    protected function pendingByPoLine(string $poCode): array
    {
        $rows = GrnLine::query()
            ->join('grns', 'grns.id', '=', 'grn_lines.grn_id')
            ->join('shipment_lines', 'shipment_lines.id', '=', 'grn_lines.shipment_line_id')
            ->where('grns.po', $poCode)
            ->whereNull('grns.stock_posted_at')
            ->where('grns.status', '!=', 'Rejected')
            ->whereNotNull('shipment_lines.purchase_order_line_id')
            ->groupBy('shipment_lines.purchase_order_line_id')
            ->select('shipment_lines.purchase_order_line_id as pl', DB::raw('SUM(grn_lines.qty) as qty'))
            ->get();
        $out = [];
        foreach ($rows as $r) {
            $out[(int) $r->pl] = (int) $r->qty;
        }

        return $out;
    }
}
