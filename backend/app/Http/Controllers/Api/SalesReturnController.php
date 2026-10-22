<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SalesReturn;
use App\Services\Accounting\Posting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SalesReturnController extends Controller
{
    public function index()
    {
        return SalesReturn::orderByDesc('id')->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'invoice' => 'required|string',
            'customer' => 'nullable|string',
            'rep' => 'nullable|string',
            'amount' => 'nullable|numeric',
            'items' => 'nullable|integer',
            'reason' => 'nullable|string',
            'raised_by' => 'nullable|string',
        ]);
        $data['code'] = 'SR-' . (3300 + SalesReturn::count() + 1);
        $data['date'] = now()->toDateString();
        $data['status'] = 'Pending Approval'; // held until an admin approves

        return response()->json(SalesReturn::create($data), 201);
    }

    /** Admin approves — only here does stock get added back. */
    public function approve(SalesReturn $salesReturn)
    {
        return DB::transaction(function () use ($salesReturn) {
            // (stock restock would happen here against the return lines)
            $salesReturn->update(['status' => 'Approved']);
            Posting::salesReturn($salesReturn);

            return $salesReturn;
        });
    }

    public function reject(SalesReturn $salesReturn)
    {
        return DB::transaction(function () use ($salesReturn) {
            $salesReturn->update(['status' => 'Rejected']);
            // Unposts a return that had been approved earlier.
            Posting::salesReturn($salesReturn);

            return $salesReturn;
        });
    }

    public function destroy(SalesReturn $salesReturn)
    {
        DB::transaction(function () use ($salesReturn) {
            Posting::remove(Posting::SALES_RETURN, $salesReturn->id);
            $salesReturn->delete();
        });

        return response()->noContent();
    }
}
