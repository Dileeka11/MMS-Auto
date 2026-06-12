<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Item;
use Illuminate\Http\Request;

class ItemController extends Controller
{
    public function index()
    {
        return Item::orderBy('name')->get();
    }

    public function show(Item $item)
    {
        return $item;
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'code' => 'required|string|unique:items,code',
            'name' => 'required|string',
            'category' => 'nullable|string',
            'brand' => 'nullable|string',
            'group' => 'nullable|string',
            'unit' => 'nullable|string',
            'avg_cost' => 'nullable|numeric',
            'fifo_cost' => 'nullable|numeric',
            'price' => 'nullable|numeric',
            'qty' => 'nullable|integer',
            'reorder' => 'nullable|integer',
            'stock_by_branch' => 'nullable|array',
            'rack' => 'nullable|string',
        ]);
        $data['status'] = $this->stockStatus($data['qty'] ?? 0, $data['reorder'] ?? 12);

        return response()->json(Item::create($data), 201);
    }

    public function update(Request $request, Item $item)
    {
        $data = $request->validate([
            'code' => 'sometimes|string|unique:items,code,' . $item->id,
            'name' => 'sometimes|string',
            'category' => 'nullable|string',
            'brand' => 'nullable|string',
            'group' => 'nullable|string',
            'unit' => 'nullable|string',
            'avg_cost' => 'nullable|numeric',
            'fifo_cost' => 'nullable|numeric',
            'price' => 'nullable|numeric',
            'qty' => 'nullable|integer',
            'reorder' => 'nullable|integer',
            'stock_by_branch' => 'nullable|array',
            'rack' => 'nullable|string',
        ]);
        $item->fill($data);
        $item->status = $this->stockStatus($item->qty, $item->reorder);
        $item->save();

        return $item;
    }

    public function destroy(Item $item)
    {
        $item->delete();

        return response()->noContent();
    }

    private function stockStatus($qty, $reorder)
    {
        if ($qty <= 0) {
            return 'out';
        }

        return $qty <= $reorder ? 'low' : 'in';
    }
}
