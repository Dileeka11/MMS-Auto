<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Item;
use App\Models\Quotation;
use App\Models\Receipt;
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
            'discount_pct' => 'nullable|numeric|min:0|max:100',
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
                'code' => Invoice::nextCode(),
                'quotation' => $data['quotation'] ?? null,
                'customer' => $data['customer'],
                'rep' => $data['rep'] ?? null,
                'source' => 'web',
                'date' => $data['date'] ?? now()->toDateString(),
                'total' => $total,
                'paid' => 0,
                'due' => $total,
                'items' => count($data['lines']),
                'cost' => $costing,
                'status' => 'Unpaid',
                'discount_pct' => $data['discount_pct'] ?? 0,
                'discount_status' => !empty($data['discount_pct']) && $data['discount_pct'] > 0 ? 'pending' : null,
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

    /**
     * Record a payment against an invoice. Creates a receipt, updates the
     * invoice paid/due/status, and settles the customer outstanding.
     */
    public function pay(Request $request, Invoice $invoice)
    {
        $data = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'mode' => 'nullable|string',
            'reference' => 'nullable|string',
            'cheque_no' => 'nullable|string|max:48',
            'cheque_bank_name' => 'nullable|string|max:100',
            'cheque_date' => 'nullable|date',
            'bank_acc' => 'nullable|string|max:48',
        ]);

        return DB::transaction(function () use ($data, $invoice) {
            // never accept more than what is still due
            $amount = round(min($data['amount'], (float) $invoice->due), 2);

            $invoice->paid = round((float) $invoice->paid + $amount, 2);
            $invoice->due = round(max(0, (float) $invoice->total - $invoice->paid), 2);
            $invoice->status = $invoice->due <= 0 ? 'Paid' : 'Partial';
            $invoice->save();

            Receipt::create([
                'code' => 'RCP-' . (6600 + Receipt::count() + 1),
                'customer' => $invoice->customer,
                'date' => now()->toDateString(),
                'amount' => $amount,
                'mode' => $data['mode'] ?? 'Cash',
                'against' => $invoice->code,
                'reference' => $data['reference'] ?? null,
                'cheque_no' => $data['cheque_no'] ?? null,
                'cheque_bank_name' => $data['cheque_bank_name'] ?? null,
                'cheque_date' => $data['cheque_date'] ?? null,
                'bank_acc' => $data['bank_acc'] ?? null,
            ]);

            $cust = Customer::where('name', $invoice->customer)->first();
            if ($cust) {
                $cust->outstanding = max(0, $cust->outstanding - $amount);
                $cust->status = $cust->outstanding > $cust->limit * 0.7 ? 'risk' : 'ok';
                $cust->save();
            }

            return response()->json($invoice->load('lines'));
        });
    }

    public function approveDiscount(Invoice $invoice)
    {
        $invoice->discount_status = 'approved';
        // recalculate total and due based on discount
        $totalBeforeDiscount = $invoice->lines()->sum(DB::raw('qty * rate'));
        $invoice->total = round($totalBeforeDiscount * (1 - ($invoice->discount_pct / 100)), 2);
        $invoice->due = round(max(0, $invoice->total - $invoice->paid), 2);
        $invoice->save();
        return $invoice->load('lines');
    }

    public function rejectDiscount(Invoice $invoice)
    {
        $invoice->discount_status = 'rejected';
        $invoice->save();
        return $invoice->load('lines');
    }

    public function destroy(Invoice $invoice)
    {
        $invoice->delete();

        return response()->noContent();
    }
}
