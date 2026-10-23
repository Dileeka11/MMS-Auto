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

class ReceiptController extends Controller
{
    public function index()
    {
        return Receipt::orderByDesc('id')->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'customer' => 'required|string',
            'amount' => 'required|numeric|min:0.01',
            'mode' => 'nullable|string',
            // which Cash Book account the money went into (null = by mode)
            'account_id' => ['nullable', 'integer', Rule::exists('accounts', 'id')->where('is_cashbook', 1)->where('is_active', 1)],
            'reference' => 'nullable|string',
            'cheque_no' => 'nullable|string|max:48',
            'cheque_bank_name' => 'nullable|string|max:100',
            'cheque_date' => 'nullable|date',
        ]);

        return DB::transaction(function () use ($data) {
            $receipt = Receipt::create([
                'code' => Receipt::nextCode(),
                'customer' => $data['customer'],
                'date' => now()->toDateString(),
                'amount' => $data['amount'],
                'mode' => $data['mode'] ?? 'Cash',
                'against' => $data['against'] ?? 'On Account',
                'reference' => $data['reference'] ?? null,
                'cheque_no' => $data['cheque_no'] ?? null,
                'cheque_bank_name' => $data['cheque_bank_name'] ?? null,
                'cheque_date' => $data['cheque_date'] ?? null,
                'account_id' => $data['account_id'] ?? null,
            ]);
            Posting::receipt($receipt);

            // settle customer outstanding
            Customer::adjustOutstanding($data['customer'], -(float) $data['amount']);

            return response()->json($receipt, 201);
        });
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
