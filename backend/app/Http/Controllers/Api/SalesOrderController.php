<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Item;
use App\Models\SalesOrder;
use App\Models\SalesRep;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Dispatch-note flow. App-created sales orders are dispatched (reserving
 * stock) and then converted to invoices (reducing stock, releasing the
 * reservation).
 */
class SalesOrderController extends Controller
{
    /** List sales orders, optionally filtered by status. */
    public function index(Request $request)
    {
        return SalesOrder::with('lines')
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->query('status')))
            ->orderByDesc('id')
            ->get();
    }

    /**
     * Generate a dispatch note for a pending order. Line quantities can be
     * edited (e.g. 10 ordered but only 9 available). Reserves the dispatched
     * quantity against each item.
     */
    public function dispatchOrder(Request $request, SalesOrder $salesOrder)
    {
        if ($salesOrder->status !== 'pending') {
            throw ValidationException::withMessages([
                'status' => "Only pending orders can be dispatched (this one is {$salesOrder->status}).",
            ]);
        }

        $data = $request->validate([
            'date' => 'nullable|date',
            'lines' => 'required|array|min:1',
            'lines.*.id' => 'nullable|integer',
            'lines.*.code' => 'nullable|string',
            'lines.*.name' => 'required|string',
            'lines.*.qty' => 'required|integer|min:1',
            'lines.*.rate' => 'required|numeric|min:0',
            'lines.*.method' => 'nullable|in:FIFO,Average',
        ]);

        return DB::transaction(function () use ($data, $salesOrder) {
            // Replace the order lines with the (possibly edited) dispatch lines.
            $salesOrder->lines()->delete();
            $total = 0;

            foreach ($data['lines'] as $l) {
                $item = ! empty($l['code']) ? Item::where('code', $l['code'])->first() : null;
                $salesOrder->lines()->create([
                    'code' => $l['code'] ?? null,
                    'name' => $l['name'],
                    'qty' => $l['qty'],
                    'rate' => $l['rate'],
                    'fifo_cost' => $item->fifo_cost ?? 0,
                    'avg_cost' => $item->avg_cost ?? 0,
                    'method' => $l['method'] ?? 'FIFO',
                ]);
                $total += $l['qty'] * $l['rate'];

                // Reserve the dispatched quantity (never above on-hand).
                if ($item) {
                    $item->reserved = min((int) $item->qty, (int) $item->reserved + (int) $l['qty']);
                    $item->save();
                }
            }

            $salesOrder->update([
                'total' => $total,
                'items' => count($data['lines']),
                'status' => 'dispatched',
                'dispatch_no' => $salesOrder->dispatch_no ?: SalesOrder::nextDispatchNo(),
                'dispatch_date' => $data['date'] ?? now()->toDateString(),
            ]);

            return response()->json($salesOrder->load('lines'));
        });
    }

    /**
     * Convert a dispatched order into a sales invoice. Reduces on-hand stock
     * and releases the reservation. All invoices post to outstanding
     * (due = total) regardless of terms; settlement happens separately.
     */
    public function invoice(Request $request, SalesOrder $salesOrder)
    {
        if ($salesOrder->status !== 'dispatched') {
            throw ValidationException::withMessages([
                'status' => "Only dispatched orders can be invoiced (this one is {$salesOrder->status}).",
            ]);
        }

        $data = $request->validate([
            'terms' => 'nullable|string|max:24',
            'date' => 'nullable|date',
        ]);

        return DB::transaction(function () use ($data, $salesOrder) {
            $salesOrder->load('lines');

            $total = 0;
            $methods = [];
            foreach ($salesOrder->lines as $l) {
                $total += $l->qty * $l->rate;
                $methods[$l->method] = true;
            }
            $costing = count($methods) > 1 ? 'Mixed' : (array_key_first($methods) ?: 'FIFO');

            $inv = Invoice::create([
                'code' => Invoice::nextCode(),
                'customer' => $salesOrder->customer,
                'rep' => $salesOrder->rep,
                'source' => 'app',
                'terms' => $data['terms'] ?? 'Cash',
                'date' => $data['date'] ?? now()->toDateString(),
                'total' => $total,
                'paid' => 0,
                'due' => $total,
                'items' => $salesOrder->lines->count(),
                'cost' => $costing,
                'status' => 'Unpaid',
                'discount_pct' => $salesOrder->discount_pct ?? 0,
                'discount_status' => $salesOrder->discount_status,
            ]);

            foreach ($salesOrder->lines as $l) {
                $inv->lines()->create([
                    'code' => $l->code,
                    'name' => $l->name,
                    'qty' => $l->qty,
                    'rate' => $l->rate,
                    'fifo_cost' => $l->fifo_cost,
                    'avg_cost' => $l->avg_cost,
                    'method' => $l->method,
                ]);

                $item = ! empty($l->code) ? Item::where('code', $l->code)->first() : null;
                if ($item) {
                    // Release the reservation and reduce on-hand stock.
                    $item->reserved = max(0, (int) $item->reserved - (int) $l->qty);
                    $item->qty = max(0, (int) $item->qty - (int) $l->qty);
                    $item->status = $item->qty <= 0 ? 'out' : ($item->qty <= $item->reorder ? 'low' : 'in');
                    $item->save();
                }
            }

            $salesOrder->update([
                'status' => 'invoiced',
                'invoice_code' => $inv->code,
            ]);

            // Now that it's a real sale, bump the rep's aggregates.
            $rep = SalesRep::where('name', $salesOrder->rep)->orWhere('code', $salesOrder->rep)->first();
            if ($rep) {
                $rep->increment('invoices');
                $rep->increment('achieved', $total);
            }

            return response()->json($inv->load('lines'), 201);
        });
    }

    /** Cancel an order. A dispatched order releases its reservation first. */
    public function destroy(SalesOrder $salesOrder)
    {
        if ($salesOrder->status === 'invoiced') {
            throw ValidationException::withMessages([
                'status' => 'An invoiced order cannot be deleted.',
            ]);
        }

        DB::transaction(function () use ($salesOrder) {
            if ($salesOrder->status === 'dispatched') {
                foreach ($salesOrder->lines as $l) {
                    if (! empty($l->code)) {
                        $item = Item::where('code', $l->code)->first();
                        if ($item) {
                            $item->reserved = max(0, (int) $item->reserved - (int) $l->qty);
                            $item->save();
                        }
                    }
                }
            }
            $salesOrder->delete();
        });

        return response()->noContent();
    }
}
