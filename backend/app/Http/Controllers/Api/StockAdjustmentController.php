<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Models\StockAdjustment;
use App\Services\Accounting\Posting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StockAdjustmentController extends Controller
{
    public function index()
    {
        return StockAdjustment::orderByDesc('id')->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'item_code' => 'nullable|string',
            'item' => 'nullable|string',
            'type' => 'required|in:Increase,Decrease',
            'qty' => 'required|integer|min:1',
            'reason' => 'nullable|string',
            'by' => 'nullable|string',
        ]);

        return DB::transaction(function () use ($data) {
            $item = ! empty($data['item_code']) ? Item::where('code', $data['item_code'])->first() : null;
            $adj = StockAdjustment::create([
                'code' => 'ADJ-' . (100 + StockAdjustment::count() + 1),
                'item' => $data['item'] ?? ($item->name ?? ''),
                'item_code' => $data['item_code'] ?? ($item->code ?? null),
                'type' => $data['type'],
                'qty' => $data['qty'],
                'reason' => $data['reason'] ?? null,
                'date' => now()->toDateString(),
                'by' => $data['by'] ?? 'K. Bandara',
                'unit_cost' => $item ? (float) $item->avg_cost : 0,
            ]);
            if ($item) {
                $item->qty = max(0, $item->qty + ($data['type'] === 'Increase' ? $data['qty'] : -$data['qty']));
                $item->status = $item->qty <= 0 ? 'out' : ($item->qty <= $item->reorder ? 'low' : 'in');
                $item->save();
            }

            Posting::stockAdjustment($adj);

            return response()->json($adj, 201);
        });
    }

    public function destroy(StockAdjustment $stockAdjustment)
    {
        DB::transaction(function () use ($stockAdjustment) {
            Posting::remove(Posting::STOCK_ADJUSTMENT, $stockAdjustment->id);
            $stockAdjustment->delete();
        });

        return response()->noContent();
    }
}
