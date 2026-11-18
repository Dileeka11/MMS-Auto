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
            'tax_no' => 'nullable|string|max:64',
            'address' => 'nullable|string',
            // New customers are registered with their Business Registration
            // and a photo of the shop.
            'br_no' => 'nullable|string|max:64',
            'br_doc' => ['required', 'string', AttachmentController::rule('customers')],
            'shop_photo' => ['required', 'string', AttachmentController::rule('customers')],
        ], [
            'br_doc.required' => 'Attach a copy of the Business Registration (BR).',
            'shop_photo.required' => 'Attach a photo of the shop.',
        ]);
        $data['outstanding'] = 0;
        $data['status'] = 'ok';

        return response()->json(Customer::create($data), 201);
    }

    public function update(Request $request, Customer $customer)
    {
        $request->validate([
            'br_no' => 'nullable|string|max:64',
            'br_doc' => ['nullable', 'string', AttachmentController::rule('customers')],
            'shop_photo' => ['nullable', 'string', AttachmentController::rule('customers')],
        ]);
        $customer->fill($request->only(['name', 'contact', 'city', 'credit', 'limit', 'rep', 'tax_no', 'address', 'br_no', 'br_doc', 'shop_photo']));
        $customer->status = $customer->limit > 0 && $customer->outstanding >= $customer->limit * 0.8 ? 'risk' : 'ok';
        $customer->save();

        return $customer;
    }

    public function destroy(Customer $customer)
    {
        $customer->delete();

        return response()->noContent();
    }
}
