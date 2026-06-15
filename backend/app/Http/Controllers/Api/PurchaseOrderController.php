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
        return PurchaseOrder::with(['lines', 'shipments'])->orderByDesc('id')->get();
    }

    public function show(PurchaseOrder $purchaseOrder)
    {
        return $purchaseOrder->load(['lines', 'shipments.lines', 'shipments.extras']);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'supplier' => 'required|string',
            'supplier_contact' => 'nullable|string',
            'date' => 'nullable|date',
            'pi_number' => 'nullable|string',
            'pi_date' => 'nullable|date',
            'payment_terms' => 'nullable|string',
            'inco_terms' => 'nullable|string',
            'currency' => 'nullable|string',
            'notes' => 'nullable|string',
            'lines' => 'required|array|min:1',
            'lines.*.code' => 'nullable|string',
            'lines.*.hs_code' => 'nullable|string',
            'lines.*.item' => 'required|string',
            'lines.*.qty' => 'required|numeric|min:1',
            'lines.*.cost' => 'required|numeric',
        ]);

        return DB::transaction(function () use ($data) {
            $total = collect($data['lines'])->sum(fn ($l) => (int) $l['qty'] * (float) $l['cost']);
            $po = PurchaseOrder::create([
                'code' => $this->nextCode(),
                'supplier' => $data['supplier'],
                'supplier_contact' => $data['supplier_contact'] ?? null,
                'date' => $data['date'] ?? now()->toDateString(),
                'pi_number' => $data['pi_number'] ?? null,
                'pi_date' => $data['pi_date'] ?? null,
                'payment_terms' => $data['payment_terms'] ?? null,
                'inco_terms' => $data['inco_terms'] ?? null,
                'currency' => $data['currency'] ?? 'LKR',
                'notes' => $data['notes'] ?? null,
                'total' => $total,
                'status' => 'Pending',
            ]);
            foreach ($data['lines'] as $l) {
                $qty = (int) $l['qty'];
                $po->lines()->create([
                    'code' => $l['code'] ?? null,
                    'hs_code' => $l['hs_code'] ?? null,
                    'item' => $l['item'],
                    'qty' => $qty,
                    'balance_qty' => $qty,
                    'received_qty' => 0,
                    'cost' => $l['cost'],
                    'total' => $qty * (float) $l['cost'],
                ]);
            }

            return response()->json($po->load('lines'), 201);
        });
    }

    public function update(Request $request, PurchaseOrder $purchaseOrder)
    {
        $purchaseOrder->update($request->only([
            'supplier', 'date', 'status', 'pi_number', 'pi_date',
            'payment_terms', 'inco_terms', 'currency', 'supplier_contact', 'notes',
        ]));

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
