<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Receipt;
use App\Services\Accounting\Posting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ReceiptController extends Controller
{
    public function index()
    {
        return Receipt::orderByDesc('id')->get();
    }

    /**
     * Record a customer payment. Each entry in `allocations` settles one of
     * the customer's invoices and gets its own receipt (against = invoice
     * code), so deleting a receipt reopens exactly the invoice it paid.
     * Whatever is not allocated to an invoice (e.g. an opening balance) is
     * recorded as one "On Account" receipt. Returns the receipts created.
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'customer' => 'required|string',
            'amount' => 'required|numeric|min:0.01',
            'date' => 'nullable|date',
            'mode' => 'nullable|string',
            // which Cash Book account the money went into (null = by mode)
            'account_id' => ['nullable', 'integer', Rule::exists('accounts', 'id')->where('is_cashbook', 1)->where('is_active', 1)],
            'reference' => 'nullable|string',
            'cheque_no' => 'nullable|string|max:48',
            'cheque_bank_name' => 'nullable|string|max:100',
            'cheque_date' => 'nullable|date',
            'allocations' => 'nullable|array',
            'allocations.*.invoice_id' => 'required|integer|exists:invoices,id',
            'allocations.*.amount' => 'required|numeric|min:0',
        ]);

        return DB::transaction(function () use ($data) {
            $total = round((float) $data['amount'], 2);
            $allocated = 0.0;
            $receipts = [];

            foreach ($data['allocations'] ?? [] as $i => $a) {
                $want = round((float) $a['amount'], 2);
                if ($want <= 0) {
                    continue;
                }
                $invoice = Invoice::whereKey($a['invoice_id'])->lockForUpdate()->firstOrFail();
                if ($invoice->customer !== $data['customer']) {
                    throw ValidationException::withMessages([
                        "allocations.$i.invoice_id" => "Invoice {$invoice->code} does not belong to {$data['customer']}.",
                    ]);
                }
                // never take more than what is still due on the invoice
                $amount = round(min($want, (float) $invoice->due, $total - $allocated), 2);
                if ($amount <= 0) {
                    continue;
                }

                $invoice->paid = round((float) $invoice->paid + $amount, 2);
                $invoice->due = round(max(0, (float) $invoice->total - $invoice->paid), 2);
                $invoice->status = $invoice->due <= 0 ? 'Paid' : 'Partial';
                $invoice->save();

                $receipts[] = $this->record($data, $amount, $invoice->code);
                $allocated = round($allocated + $amount, 2);
            }

            // the rest settles the customer's balance without a specific invoice
            $rest = round($total - $allocated, 2);
            if ($rest > 0) {
                $receipts[] = $this->record($data, $rest, 'On Account');
            }

            Customer::adjustOutstanding($data['customer'], -$total);

            return response()->json($receipts, 201);
        });
    }

    /** One receipt row plus its journal entry. */
    private function record(array $data, float $amount, string $against): Receipt
    {
        $cheque = strcasecmp((string) ($data['mode'] ?? ''), 'Cheque') === 0;
        $receipt = Receipt::create([
            'code' => Receipt::nextCode(),
            'customer' => $data['customer'],
            'date' => $data['date'] ?? now()->toDateString(),
            'amount' => $amount,
            'mode' => $data['mode'] ?? 'Cash',
            'against' => $against,
            'reference' => $data['reference'] ?? null,
            'cheque_no' => $cheque ? ($data['cheque_no'] ?? null) : null,
            'cheque_bank_name' => $cheque ? ($data['cheque_bank_name'] ?? null) : null,
            'cheque_date' => $cheque ? ($data['cheque_date'] ?? null) : null,
            'account_id' => $data['account_id'] ?? null,
        ]);
        Posting::receipt($receipt);

        return $receipt;
    }

    /** Delete a receipt: the customer owes it again, and an invoice it paid reopens. */
    public function destroy(Receipt $receipt)
    {
        DB::transaction(function () use ($receipt) {
            $invoice = $receipt->against ? Invoice::where('code', $receipt->against)->first() : null;
            if ($invoice) {
                $invoice->paid = round(max(0, (float) $invoice->paid - (float) $receipt->amount), 2);
                $invoice->due = round(max(0, (float) $invoice->total - $invoice->paid), 2);
                $invoice->status = $invoice->due <= 0 ? 'Paid' : ($invoice->paid > 0 ? 'Partial' : 'Unpaid');
                $invoice->save();
            }
            Customer::adjustOutstanding($receipt->customer, (float) $receipt->amount);
            Posting::remove(Posting::RECEIPT, $receipt->id);
            $receipt->delete();
        });

        return response()->noContent();
    }
}
