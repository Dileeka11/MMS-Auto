<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Quotation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class QuotationController extends Controller
{
    public function index()
    {
        return Quotation::with('lines')->orderByDesc('id')->get();
    }

    public function show(Quotation $quotation)
    {
        return $quotation->load('lines');
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'customer' => 'required|string',
            'rep' => 'nullable|string',
            'date' => 'nullable|date',
            'valid_until' => 'nullable|date',
            'lines' => 'required|array|min:1',
            'lines.*.code' => 'nullable|string',
            'lines.*.name' => 'required|string',
            'lines.*.qty' => 'required|integer|min:1',
            'lines.*.rate' => 'required|numeric',
        ]);

        return DB::transaction(function () use ($data) {
            $total = collect($data['lines'])->sum(fn ($l) => $l['qty'] * $l['rate']);
            $q = Quotation::create([
                'code' => 'QT-' . (9100 + Quotation::count() + 1),
                'customer' => $data['customer'],
                'rep' => $data['rep'] ?? null,
                'date' => $data['date'] ?? now()->toDateString(),
                'valid_until' => $data['valid_until'] ?? null,
                'total' => $total,
                'items' => count($data['lines']),
                'status' => 'Open',
                'cost' => '-',
            ]);
            foreach ($data['lines'] as $l) {
                $q->lines()->create([
                    'code' => $l['code'] ?? null,
                    'name' => $l['name'],
                    'qty' => $l['qty'],
                    'rate' => $l['rate'],
                ]);
            }

            return response()->json($q->load('lines'), 201);
        });
    }

    public function update(Request $request, Quotation $quotation)
    {
        $quotation->update($request->only(['customer', 'rep', 'status', 'cost']));

        return $quotation->load('lines');
    }

    public function destroy(Quotation $quotation)
    {
        $quotation->delete();

        return response()->noContent();
    }
}
