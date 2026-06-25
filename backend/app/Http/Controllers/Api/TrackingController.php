<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Grn;
use App\Models\GrnLine;
use App\Models\Item;
use App\Models\PurchaseOrder;
use App\Models\Shipment;
use Illuminate\Support\Facades\DB;

class TrackingController extends Controller
{
    /**
     * PO Balance + Shipment status + Financial impact dashboard.
     */
    public function index()
    {
        $pos = PurchaseOrder::with(['lines', 'shipments.lines'])->orderByDesc('id')->get();

        $rows = $pos->map(function ($po) {
            $orderedQty = (int) $po->lines->sum('qty');
            $receivedQty = (int) $po->lines->sum('received_qty');
            $balanceQty = (int) $po->lines->sum('balance_qty');

            // Financial impact = sum of landed (with VAT) value actually received
            // across all shipments under this PO.
            $stockValue = 0.0;
            foreach ($po->shipments as $s) {
                foreach ($s->lines as $sl) {
                    $stockValue += ($sl->qty ?? 0) * ($sl->unit_cost_with_vat ?? $sl->landed_cost ?? 0);
                }
            }

            return [
                'po_code' => $po->code,
                'supplier' => $po->supplier,
                'pi_number' => $po->pi_number,
                'date' => optional($po->date)->toDateString(),
                'currency' => $po->currency,
                'total' => (float) $po->total,
                'ordered_qty' => $orderedQty,
                'received_qty' => $receivedQty,
                'balance_qty' => $balanceQty,
                'progress' => $orderedQty > 0 ? round($receivedQty * 100 / $orderedQty, 1) : 0,
                'status' => $po->status,
                'stock_value' => round($stockValue, 2),
                'shipments' => $po->shipments->map(fn ($s) => [
                    'code' => $s->code,
                    'seq' => $s->seq,
                    'date' => optional($s->date)->toDateString(),
                    'status' => $s->status,
                    'items_total' => (float) $s->items_total,
                    'extras_total' => (float) $s->extras_total,
                    'landed_total' => (float) $s->landed_total,
                    'invoice_no' => $s->invoice_no,
                    'shipment_type' => $s->shipment_type,
                    'shipment_volume' => $s->shipment_volume,
                ])->values(),
            ];
        });

        $totalStockValue = (float) GrnLine::sum(DB::raw('qty * unit_cost_wo_vat'));
        $totalReceivedValue = (float) Grn::sum('total');

        return [
            'summary' => [
                'pos' => $pos->count(),
                'shipments' => Shipment::count(),
                'grns' => Grn::count(),
                'open_balance_qty' => (int) $rows->sum('balance_qty'),
                'received_qty' => (int) $rows->sum('received_qty'),
                'ordered_qty' => (int) $rows->sum('ordered_qty'),
                'stock_value_added' => round($totalStockValue, 2),
                'received_value' => round($totalReceivedValue, 2),
                'items_on_hand' => (int) Item::sum('qty'),
            ],
            'rows' => $rows,
        ];
    }
}
