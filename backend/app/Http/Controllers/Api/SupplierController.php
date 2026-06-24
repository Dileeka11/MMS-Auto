<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Supplier;
use Illuminate\Http\Request;

class SupplierController extends Controller
{
    public function index()
    {
        return Supplier::orderBy('name')->get();
    }

    public function show(Supplier $supplier)
    {
        return $supplier;
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'code' => 'nullable|string',
            'name' => 'required|string',
            'contact' => 'nullable|string',
            'email' => 'nullable|email',
            'city' => 'nullable|string',
            'country' => 'nullable|string',
            'tax_no' => 'nullable|string',
            'payment_terms' => 'nullable|string',
            'currency' => 'nullable|string',
            'address' => 'nullable|string',
            'notes' => 'nullable|string',
            'status' => 'nullable|string',
        ]);
        $data['status'] = $data['status'] ?? 'Active';
        if (empty($data['code'])) {
            $next = (int) (Supplier::max('id') ?? 0) + 1;
            $data['code'] = 'SUP-' . str_pad((string) $next, 3, '0', STR_PAD_LEFT);
        }

        return response()->json(Supplier::create($data), 201);
    }

    public function update(Request $request, Supplier $supplier)
    {
        $data = $request->validate([
            'code' => 'nullable|string',
            'name' => 'sometimes|required|string',
            'contact' => 'nullable|string',
            'email' => 'nullable|email',
            'city' => 'nullable|string',
            'country' => 'nullable|string',
            'tax_no' => 'nullable|string',
            'payment_terms' => 'nullable|string',
            'currency' => 'nullable|string',
            'address' => 'nullable|string',
            'notes' => 'nullable|string',
            'status' => 'nullable|string',
        ]);
        $supplier->fill($data);
        $supplier->save();

        return $supplier;
    }

    public function destroy(Supplier $supplier)
    {
        $supplier->delete();

        return response()->noContent();
    }
}
