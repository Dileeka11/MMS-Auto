<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Receipt;
use App\Services\Accounting\Posting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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
            ]);
            Posting::receipt($receipt);

            // settle customer outstanding
            $cust = Customer::where('name', $data['customer'])->first();
            if ($cust) {
                $cust->outstanding = max(0, $cust->outstanding - $data['amount']);
                $cust->status = $cust->outstanding > $cust->limit * 0.7 ? 'risk' : 'ok';
                $cust->save();
            }

            return response()->json($receipt, 201);
        });
    }

    public function destroy(Receipt $receipt)
    {
        DB::transaction(function () use ($receipt) {
            Posting::remove(Posting::RECEIPT, $receipt->id);
            $receipt->delete();
        });

        return response()->noContent();
    }
}
