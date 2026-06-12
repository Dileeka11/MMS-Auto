<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    public function index()
    {
        return Customer::orderBy('name')->get();
    }

    public function show(Customer $customer)
    {
        return $customer;
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string',
            'contact' => 'nullable|string',
            'city' => 'nullable|string',
            'credit' => 'nullable|integer',
            'limit' => 'nullable|numeric',
            'rep' => 'nullable|string',
        ]);
        $data['outstanding'] = 0;
        $data['status'] = 'ok';

        return response()->json(Customer::create($data), 201);
    }

    public function update(Request $request, Customer $customer)
    {
        $customer->fill($request->only(['name', 'contact', 'city', 'credit', 'limit', 'rep']));
        $customer->status = $customer->outstanding > $customer->limit * 0.7 ? 'risk' : 'ok';
        $customer->save();

        return $customer;
    }

    public function destroy(Customer $customer)
    {
        $customer->delete();

        return response()->noContent();
    }
}
