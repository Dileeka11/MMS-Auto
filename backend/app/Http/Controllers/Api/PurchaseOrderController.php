<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PurchaseOrder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PurchaseOrderController extends Controller
{
    public function index()
    {
        return PurchaseOrder::with('lines')->orderByDesc('id')->get();
    }

    public function show(PurchaseOrder $purchaseOrder)
    {
        return $purchaseOrder->load('lines');
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'supplier' => 'required|string',
            'date' => 'nullable|date',
            'lines' => 'required|array|min:1',
            'lines.*.code' => 'nullable|string',
            'lines.*.item' => 'required|string',
            'lines.*.qty' => 'required|integer|min:1',
            'lines.*.cost' => 'required|numeric',
        ]);

        return DB::transaction(function () use ($data) {
            $total = collect($data['lines'])->sum(fn ($l) => $l['qty'] * $l['cost']);
            $po = PurchaseOrder::create([
                'code' => $this->nextCode(),
                'supplier' => $data['supplier'],
                'date' => $data['date'] ?? now()->toDateString(),
                'total' => $total,
                'status' => 'Pending',
            ]);
            foreach ($data['lines'] as $l) {
                $po->lines()->create([
                    'code' => $l['code'] ?? null,
                    'item' => $l['item'],
                    'qty' => $l['qty'],
                    'cost' => $l['cost'],
                    'total' => $l['qty'] * $l['cost'],
                ]);
            }

            return response()->json($po->load('lines'), 201);
        });
    }

    public function update(Request $request, PurchaseOrder $purchaseOrder)
    {
        $purchaseOrder->update($request->only(['supplier', 'date', 'status']));

        return $purchaseOrder->load('lines');
    }

    public function destroy(PurchaseOrder $purchaseOrder)
    {
        $purchaseOrder->delete();

        return response()->noContent();
    }

    private function nextCode()
    {
        return 'PO-' . (4400 + PurchaseOrder::count() + 1);
    }
}
