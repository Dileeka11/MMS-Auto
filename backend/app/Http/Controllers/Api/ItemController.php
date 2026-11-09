<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Support\Fifo;
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

        $item = Item::create($data);
        Fifo::sync($item); // opening stock becomes the first FIFO layer

        return response()->json($item->fresh(), 201);
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
        $qtyChanged = $item->isDirty('qty');
        $item->save();
        if ($qtyChanged) {
            Fifo::sync($item); // a hand-edited qty adds / trims FIFO layers to match
        }

        return $item;
    }

    public function destroy(Item $item)
    {
        Fifo::forget($item->id);
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
                    Fifo::sync($item);
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
                    $qtyChanged = $existing->isDirty('qty');
                    $existing->save();
                    if ($qtyChanged) {
                        Fifo::sync($existing);
                    }
                    $updated++;
                } else {
                    $item = Item::create($row);
                    Fifo::sync($item);
                    $existingByCode->put($norm($code), $item); // guard against dupes within the same file
                    $created++;
                }
            }
        });

        return response()->json(['created' => $created, 'updated' => $updated]);
    }

    /**
     * Price-only update from Excel — keys on `code` (case-insensitive, like the
     * unique index). Touches nothing but `price`, never creates items, and
     * reports the codes that are not in Item Master.
     */
    public function bulkPrice(Request $request)
    {
        $data = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.code' => 'required|string',
            'items.*.price' => 'required|numeric|min:0',
        ]);

        $norm = function ($c) { return mb_strtolower(trim((string) $c)); };
        $existingByCode = Item::all()->keyBy(function ($it) use ($norm) { return $norm($it->code); });

        $updated = 0;
        $unchanged = 0;
        $notFound = [];
        DB::transaction(function () use ($data, $existingByCode, $norm, &$updated, &$unchanged, &$notFound) {
            foreach ($data['items'] as $row) {
                $item = $existingByCode->get($norm($row['code']));
                if (!$item) {
                    $notFound[] = trim((string) $row['code']);
                    continue;
                }
                $price = round((float) $row['price'], 2);
                if (round((float) $item->price, 2) === $price) {
                    $unchanged++;
                    continue;
                }
                $item->price = $price;
                $item->save();
                $updated++;
            }
        });

        return response()->json(['updated' => $updated, 'unchanged' => $unchanged, 'notFound' => $notFound]);
    }

    /** Delete every item — used by Item Master "Clear All". */
    public function clearAll()
    {
        $count = Item::count();
        Fifo::forget();
        Item::query()->delete();

        return response()->json(['deleted' => $count]);
    }
}
