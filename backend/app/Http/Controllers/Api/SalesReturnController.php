<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\InvoiceLine;
use App\Models\Item;
use App\Models\SalesReturn;
use App\Services\Accounting\Posting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Sales returns. A return lists the invoice lines coming back; its value is
 * worked out from the invoice (net rate after any approved discount, plus
 * VAT if the invoice charged it). Nothing moves until an admin approves:
 * approval restocks the goods at the cost they were sold at, credits the
 * customer and posts the journal. Returns raised without lines (older ones,
 * or a plain credit) carry only an amount and don't touch stock.
 */
class SalesReturnController extends Controller
{
    public function index()
    {
        return SalesReturn::with('lines')->orderByDesc('id')->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'invoice' => 'required|string',
            'customer' => 'nullable|string',
            'rep' => 'nullable|string',
            'amount' => 'nullable|numeric|min:0',
            'items' => 'nullable|integer',
            'reason' => 'nullable|string',
            'raised_by' => 'nullable|string',
            'lines' => 'nullable|array',
            'lines.*.invoice_line_id' => 'required|integer',
            'lines.*.qty' => 'required|integer|min:1',
        ]);

        $invoice = Invoice::where('code', $data['invoice'])->first()
            ?: (ctype_digit($data['invoice']) ? Invoice::find($data['invoice']) : null);
        $lines = $data['lines'] ?? [];
        if ($lines && ! $invoice) {
            throw ValidationException::withMessages(['invoice' => 'Invoice not found.']);
        }

        return DB::transaction(function () use ($data, $invoice, $lines) {
            $rows = [];
            if ($lines) {
                $factor = $invoice->discount_status === 'approved' ? 1 - $invoice->discount_pct / 100 : 1;
                foreach ($lines as $l) {
                    $il = InvoiceLine::where('invoice_id', $invoice->id)->find($l['invoice_line_id']);
                    if (! $il) {
                        throw ValidationException::withMessages(['lines' => 'A returned line is not on invoice ' . $invoice->code . '.']);
                    }
                    $returned = (int) DB::table('sales_return_lines as l')
                        ->join('sales_returns as r', 'r.id', '=', 'l.sales_return_id')
                        ->where('l.invoice_line_id', $il->id)
                        ->where('r.status', '!=', 'Rejected')
                        ->sum('l.qty');
                    $left = $il->qty - $returned;
                    if ($l['qty'] > $left) {
                        throw ValidationException::withMessages(['lines' => "{$il->name}: only {$left} of {$il->qty} can still be returned."]);
                    }
                    $rows[] = [
                        'invoice_line_id' => $il->id,
                        'code' => $il->code,
                        'name' => $il->name,
                        'qty' => (int) $l['qty'],
                        'rate' => round($il->rate * $factor, 2),
                        'unit_cost' => (float) ($il->method === 'Average' ? $il->avg_cost : $il->fifo_cost),
                    ];
                }
            }

            if ($rows) {
                $net = round(collect($rows)->sum(fn ($r) => $r['qty'] * $r['rate']), 2);
                $vat = $invoice->vat_applied ? round($net * $invoice->vat_pct / 100, 2) : 0;
                $amount = round($net + $vat, 2);
                $items = collect($rows)->sum('qty');
            } else {
                $amount = (float) ($data['amount'] ?? 0);
                $vat = 0;
                $items = $data['items'] ?? 1;
            }

            $return = SalesReturn::create([
                'code' => SalesReturn::nextCode(),
                'invoice' => $invoice ? $invoice->code : $data['invoice'],
                'customer' => $invoice ? $invoice->customer : ($data['customer'] ?? '—'),
                'rep' => $data['rep'] ?? ($invoice ? $invoice->rep : null),
                'date' => now()->toDateString(),
                'amount' => $amount,
                'vat_amount' => $vat,
                'items' => $items,
                'reason' => $data['reason'] ?? null,
                'raised_by' => $data['raised_by'] ?? null,
                'status' => 'Pending Approval', // held until an admin approves
            ]);
            foreach ($rows as $r) {
                $return->lines()->create($r);
            }

            return response()->json($return->load('lines'), 201);
        });
    }

    /** Admin approves — restock, credit the customer, post the journal. */
    public function approve(SalesReturn $salesReturn)
    {
        if ($salesReturn->status !== 'Pending Approval') {
            throw ValidationException::withMessages(['status' => "This return is already {$salesReturn->status}."]);
        }

        return DB::transaction(function () use ($salesReturn) {
            $salesReturn->load('lines');
            foreach ($salesReturn->lines as $l) {
                $item = $l->code ? Item::where('code', $l->code)->first() : null;
                if ($item) {
                    $item->addStock($l->qty, $l->unit_cost);
                }
            }
            $salesReturn->update(['status' => 'Approved', 'restocked' => $salesReturn->lines->isNotEmpty()]);
            Customer::adjustOutstanding($salesReturn->customer, -$salesReturn->amount);
            Posting::salesReturn($salesReturn);

            return $salesReturn->load('lines');
        });
    }

    public function reject(SalesReturn $salesReturn)
    {
        if ($salesReturn->status !== 'Pending Approval') {
            throw ValidationException::withMessages(['status' => "This return is already {$salesReturn->status}. Delete it to reverse an approved return."]);
        }
        $salesReturn->update(['status' => 'Rejected']);

        return $salesReturn->load('lines');
    }

    /** Deleting an approved return takes the stock back out and re-charges the customer. */
    public function destroy(SalesReturn $salesReturn)
    {
        DB::transaction(function () use ($salesReturn) {
            $salesReturn->load('lines');
            if ($salesReturn->status === 'Approved') {
                foreach ($salesReturn->lines as $l) {
                    $item = $salesReturn->restocked && $l->code ? Item::where('code', $l->code)->first() : null;
                    if (! $item) {
                        continue;
                    }
                    if ($item->qty < $l->qty) {
                        throw ValidationException::withMessages([
                            'status' => "Cannot delete: only {$item->qty} of {$item->name} left in stock, {$l->qty} came in on this return.",
                        ]);
                    }
                    $item->removeStock($l->qty, $l->unit_cost);
                }
                Customer::adjustOutstanding($salesReturn->customer, $salesReturn->amount);
            }
            Posting::remove(Posting::SALES_RETURN, $salesReturn->id);
            $salesReturn->lines()->delete();
            $salesReturn->delete();
        });

        return response()->noContent();
    }
}
