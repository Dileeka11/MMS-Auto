<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Grn;
use App\Models\PurchaseOrder;
use App\Models\Shipment;

class TrackingController extends Controller
{
    /**
     * PO Balance + Shipment status dashboard.
     */
    public function index()
    {
        $pos = PurchaseOrder::with(['lines', 'shipments'])->orderByDesc('id')->get();

        $rows = $pos->map(function ($po) {
            $orderedQty = (int) $po->lines->sum('qty');
            $receivedQty = (int) $po->lines->sum('received_qty');
            $balanceQty = (int) $po->lines->sum('balance_qty');

            return [
                'po_code' => $po->code,
                'supplier' => $po->supplier,
                'pi_number' => $po->pi_number,
                'date' => $po->date?->toDateString(),
                'currency' => $po->currency,
                'total' => (float) $po->total,
                'ordered_qty' => $orderedQty,
                'received_qty' => $receivedQty,
                'balance_qty' => $balanceQty,
                'progress' => $orderedQty > 0 ? round($receivedQty * 100 / $orderedQty, 1) : 0,
                'status' => $po->status,
                'shipments' => $po->shipments->map(fn ($s) => [
                    'code' => $s->code,
                    'seq' => $s->seq,
                    'date' => $s->date?->toDateString(),
                    'status' => $s->status,
                    'items_total' => (float) $s->items_total,
                    'extras_total' => (float) $s->extras_total,
                    'landed_total' => (float) $s->landed_total,
                ])->values(),
            ];
        });

        return [
            'summary' => [
                'pos' => $pos->count(),
                'shipments' => Shipment::count(),
                'grns' => Grn::count(),
                'open_balance_qty' => (int) $rows->sum('balance_qty'),
                'received_qty' => (int) $rows->sum('received_qty'),
                'ordered_qty' => (int) $rows->sum('ordered_qty'),
            ],
            'rows' => $rows,
        ];
    }
}
