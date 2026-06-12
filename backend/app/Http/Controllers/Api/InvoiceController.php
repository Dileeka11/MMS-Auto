<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Item;
use App\Models\Quotation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InvoiceController extends Controller
{
    public function index()
    {
        return Invoice::with('lines')->orderByDesc('id')->get();
    }

    public function show(Invoice $invoice)
    {
        return $invoice->load('lines');
    }

    /**
     * Post a sales invoice. Each line carries a per-line costing method
     * (FIFO or Average); COGS uses that method's stored cost. Stock is
     * reduced by the sold quantity.
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'customer' => 'required|string',
            'rep' => 'nullable|string',
            'date' => 'nullable|date',
            'quotation' => 'nullable|string',
            'lines' => 'required|array|min:1',
            'lines.*.code' => 'nullable|string',
            'lines.*.name' => 'required|string',
            'lines.*.qty' => 'required|integer|min:1',
            'lines.*.rate' => 'required|numeric',
            'lines.*.method' => 'nullable|in:FIFO,Average',
        ]);

        return DB::transaction(function () use ($data) {
            $total = 0;
            $methods = [];
            foreach ($data['lines'] as $l) {
                $total += $l['qty'] * $l['rate'];
                $methods[$l['method'] ?? 'FIFO'] = true;
            }
            $costing = count($methods) > 1 ? 'Mixed' : array_key_first($methods);

            $inv = Invoice::create([
                'code' => 'INV-' . (5500 + Invoice::count() + 1),
                'quotation' => $data['quotation'] ?? null,
                'customer' => $data['customer'],
                'rep' => $data['rep'] ?? null,
                'date' => $data['date'] ?? now()->toDateString(),
                'total' => $total,
                'paid' => 0,
                'due' => $total,
                'items' => count($data['lines']),
                'cost' => $costing,
                'status' => 'Unpaid',
            ]);

            foreach ($data['lines'] as $l) {
                $item = ! empty($l['code']) ? Item::where('code', $l['code'])->first() : null;
                $fifo = $item->fifo_cost ?? 0;
                $avg = $item->avg_cost ?? 0;
                $inv->lines()->create([
                    'code' => $l['code'] ?? null,
                    'name' => $l['name'],
                    'qty' => $l['qty'],
                    'rate' => $l['rate'],
                    'fifo_cost' => $fifo,
                    'avg_cost' => $avg,
                    'method' => $l['method'] ?? 'FIFO',
                ]);
                if ($item) {
                    $item->qty = max(0, $item->qty - $l['qty']);
                    $item->status = $item->qty <= 0 ? 'out' : ($item->qty <= $item->reorder ? 'low' : 'in');
                    $item->save();
                }
            }

            // mark source quotation converted
            if (! empty($data['quotation'])) {
                Quotation::where('code', $data['quotation'])->update(['status' => 'Converted']);
            }

            return response()->json($inv->load('lines'), 201);
        });
    }

    public function destroy(Invoice $invoice)
    {
        $invoice->delete();

        return response()->noContent();
    }
}
