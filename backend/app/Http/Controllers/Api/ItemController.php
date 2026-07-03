<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Item;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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
            'code' => 'nullable|string|unique:items,code',
            'hs_code' => 'nullable|string',
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
        if (empty($data['code'])) {
            $data['code'] = $this->nextCode();
        }
        $data['status'] = $this->stockStatus($data['qty'] ?? 0, $data['reorder'] ?? 12);

        return response()->json(Item::create($data), 201);
    }

    /** Generate the next available ITM-NNN code. */
    public function nextCode()
    {
        $max = 0;
        Item::where('code', 'like', 'ITM-%')->pluck('code')->each(function ($c) use (&$max) {
            $n = (int) preg_replace('/[^0-9]/', '', $c);
            if ($n > $max) { $max = $n; }
        });

        return 'ITM-' . str_pad((string) ($max + 1), 3, '0', STR_PAD_LEFT);
    }

    public function update(Request $request, Item $item)
    {
        $data = $request->validate([
            'code' => 'sometimes|string|unique:items,code,' . $item->id,
            'hs_code' => 'nullable|string',
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

    /** Bulk upsert from Excel import — keys on `code`. */
    public function bulk(Request $request)
    {
        $data = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.code' => 'nullable|string',
            'items.*.name' => 'required|string',
            'items.*.hs_code' => 'nullable|string',
            'items.*.category' => 'nullable|string',
            'items.*.brand' => 'nullable|string',
            'items.*.group' => 'nullable|string',
            'items.*.unit' => 'nullable|string',
            'items.*.avg_cost' => 'nullable|numeric',
            'items.*.fifo_cost' => 'nullable|numeric',
            'items.*.price' => 'nullable|numeric',
            'items.*.qty' => 'nullable|integer',
            'items.*.reorder' => 'nullable|integer',
            'items.*.rack' => 'nullable|string',
        ]);

        // Preload every existing item keyed by code in ONE query, and compute the
        // starting ITM-NNN counter once — instead of a lookup (and a full-table
        // scan for blank codes) on every row. Turns an O(N) import into O(1)
        // queries for the setup plus the unavoidable per-row writes.
        //
        // Keys are normalised (trim + lowercase) because the `items_code_unique`
        // index is case-insensitive: "36DU4212" and "36du4212" collide in MySQL
        // but are distinct PHP strings, so an exact-match keyBy would let the
        // second one fall through to Item::create() and blow up the whole import
        // with a 1062 duplicate-key error. Normalising makes our de-dup match the DB.
        $norm = fn ($c) => mb_strtolower(trim((string) $c));
        $existingByCode = Item::all()->keyBy(fn ($it) => $norm($it->code));
        $maxCode = 0;
        foreach ($existingByCode as $it) {
            $c = (string) $it->code;
            if (str_starts_with($c, 'ITM-')) {
                $n = (int) preg_replace('/[^0-9]/', '', $c);
                if ($n > $maxCode) { $maxCode = $n; }
            }
        }
        $nextCode = fn () => 'ITM-' . str_pad((string) (++$maxCode), 3, '0', STR_PAD_LEFT);

        $created = 0;
        $updated = 0;
        DB::transaction(function () use ($data, &$created, &$updated, $existingByCode, $nextCode, $norm) {
            foreach ($data['items'] as $row) {
                $row['unit'] = $row['unit'] ?? 'Pcs';
                $row['group'] = $row['group'] ?? 'OEM';
                $row['qty'] = $row['qty'] ?? 0;
                $row['reorder'] = $row['reorder'] ?? 12;
                $row['status'] = $this->stockStatus($row['qty'], $row['reorder']);
                $code = trim((string) ($row['code'] ?? ''));
                if ($code === '') {
                    $row['code'] = $nextCode();
                    $item = Item::create($row);
                    $existingByCode->put($norm($item->code), $item);
                    $created++;
                    continue;
                }
                $row['code'] = $code;
                $existing = $existingByCode->get($norm($code));
                if ($existing) {
                    // A later row in the same sheet updates the earlier one rather
                    // than trying (and failing) to insert a case-variant duplicate.
                    $existing->fill($row);
                    $existing->save();
                    $updated++;
                } else {
                    $item = Item::create($row);
                    $existingByCode->put($norm($code), $item); // guard against dupes within the same file
                    $created++;
                }
            }
        });

        return response()->json(['created' => $created, 'updated' => $updated]);
    }

    /** Delete every item — used by Item Master "Clear All". */
    public function clearAll()
    {
        $count = Item::count();
        Item::query()->delete();

        return response()->json(['deleted' => $count]);
    }
}
