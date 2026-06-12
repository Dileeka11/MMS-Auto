<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Receipt;
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
            'against' => 'nullable|string',
            'reference' => 'nullable|string',
        ]);

        return DB::transaction(function () use ($data) {
            $receipt = Receipt::create([
                'code' => 'RCP-' . (6600 + Receipt::count() + 1),
                'customer' => $data['customer'],
                'date' => now()->toDateString(),
                'amount' => $data['amount'],
                'mode' => $data['mode'] ?? 'Cash',
                'against' => $data['against'] ?? 'On Account',
                'reference' => $data['reference'] ?? null,
            ]);
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
        $receipt->delete();

        return response()->noContent();
    }
}
