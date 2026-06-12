<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SalesReturn;
use Illuminate\Http\Request;

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
        // (stock restock would happen here against the return lines)
        $salesReturn->update(['status' => 'Approved']);

        return $salesReturn;
    }

    public function reject(SalesReturn $salesReturn)
    {
        $salesReturn->update(['status' => 'Rejected']);

        return $salesReturn;
    }

    public function destroy(SalesReturn $salesReturn)
    {
        $salesReturn->delete();

        return response()->noContent();
    }
}
