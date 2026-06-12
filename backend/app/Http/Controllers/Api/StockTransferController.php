<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StockTransfer;
use Illuminate\Http\Request;

class StockTransferController extends Controller
{
    public function index()
    {
        return StockTransfer::orderByDesc('id')->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'from_branch' => 'required|string',
            'to_branch' => 'required|string|different:from_branch',
            'items' => 'nullable|integer',
            'qty' => 'nullable|integer',
        ]);
        $data['code'] = 'TRF-' . (200 + StockTransfer::count() + 1);
        $data['date'] = now()->toDateString();
        $data['status'] = 'In Transit';

        return response()->json(StockTransfer::create($data), 201);
    }

    public function update(Request $request, StockTransfer $stockTransfer)
    {
        $stockTransfer->update($request->only(['status']));

        return $stockTransfer;
    }

    public function destroy(StockTransfer $stockTransfer)
    {
        $stockTransfer->delete();

        return response()->noContent();
    }
}
