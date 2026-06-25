<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\HandlesApprovals;
use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Models\PurchaseOrder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class PurchaseOrderController extends Controller
{
    use HandlesApprovals;

    public function index()
    {
        return PurchaseOrder::with(['lines', 'shipments', 'approver1:id,name', 'approver2:id,name', 'rejectedBy:id,name'])
            ->orderByDesc('id')
            ->get();
    }

    public function show(PurchaseOrder $purchaseOrder)
    {
        return $purchaseOrder->load([
            'lines', 'shipments.lines', 'shipments.extras',
            'approver1:id,name', 'approver2:id,name', 'rejectedBy:id,name',
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'supplier' => 'required|string',
            'supplier_contact' => 'nullable|string',
            'date' => 'nullable|date',
            'pi_number' => 'nullable|string',
            'pi_date' => 'nullable|date',
            'order_required_month' => 'nullable|string',
            'payment_terms' => 'nullable|string',
            'inco_terms' => 'nullable|string',
            'currency' => 'nullable|string',
            'notes' => 'nullable|string',
            'lines' => 'required|array|min:1',
            'lines.*.code' => 'required|string',
            'lines.*.hs_code' => 'nullable|string',
            'lines.*.item' => 'required|string',
            'lines.*.qty' => 'required|numeric|min:1',
            'lines.*.cost' => 'required|numeric',
        ]);

        $norm = fn ($s) => strtoupper(trim((string) $s));
        $codes = collect($data['lines'])->pluck('code')->map($norm)->unique()->values();
        $itemMap = Item::all(['id', 'code'])
            ->mapWithKeys(fn ($i) => [$norm($i->code) => $i->id]);

        $unmatched = $codes->reject(fn ($c) => isset($itemMap[$c]))->values();
        if ($unmatched->isNotEmpty()) {
            throw ValidationException::withMessages([
                'lines' => 'Item code(s) not found in Item Master: ' . $unmatched->implode(', '),
            ]);
        }

        return DB::transaction(function () use ($data, $itemMap, $norm) {
            $total = collect($data['lines'])->sum(fn ($l) => (int) $l['qty'] * (float) $l['cost']);
            $po = PurchaseOrder::create([
                'code' => $this->nextCode(),
                'supplier' => $data['supplier'],
                'supplier_contact' => $data['supplier_contact'] ?? null,
                'date' => $data['date'] ?? now()->toDateString(),
                'pi_number' => $data['pi_number'] ?? null,
                'pi_date' => $data['pi_date'] ?? null,
                'order_required_month' => $data['order_required_month'] ?? null,
                'payment_terms' => $data['payment_terms'] ?? null,
                'inco_terms' => $data['inco_terms'] ?? null,
                'currency' => $data['currency'] ?? 'LKR',
                'notes' => $data['notes'] ?? null,
                'total' => $total,
                'status' => 'Awaiting Approval',
            ]);
            foreach ($data['lines'] as $l) {
                $qty = (int) $l['qty'];
                $po->lines()->create([
                    'item_id' => $itemMap[$norm($l['code'])],
                    'code' => $l['code'],
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
            'supplier', 'date', 'status', 'pi_number', 'pi_date', 'order_required_month',
            'payment_terms', 'inco_terms', 'currency', 'supplier_contact', 'notes',
        ]));

        return $purchaseOrder->load('lines');
    }

    public function destroy(PurchaseOrder $purchaseOrder)
    {
        $purchaseOrder->delete();

        return response()->noContent();
    }

    public function approve(Request $request, PurchaseOrder $purchaseOrder)
    {
        return $this->performApprove($request, $purchaseOrder, 'po')
            ->load(['lines', 'approver1:id,name', 'approver2:id,name']);
    }

    public function reject(Request $request, PurchaseOrder $purchaseOrder)
    {
        return $this->performReject($request, $purchaseOrder, 'po')
            ->load(['lines', 'rejectedBy:id,name']);
    }

    public function nextCode()
    {
        return 'PO-' . (4400 + PurchaseOrder::count() + 1);
    }
}
