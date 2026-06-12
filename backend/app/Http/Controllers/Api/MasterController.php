<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Master;
use Illuminate\Http\Request;

/**
 * Powers the 16 config-driven master files. The front-end addresses
 * them as /api/masters/{type} (e.g. masters/vehicleBrand). Records
 * keep their common columns (code, name, status) plus any extra
 * type-specific fields inside the JSON `data` column.
 */
class MasterController extends Controller
{
    /** Reserved columns that live in their own table columns. */
    private array $reserved = ['id', 'type', 'code', 'name', 'status', 'created_at', 'updated_at', 'data'];

    public function index($type)
    {
        return Master::type($type)->orderBy('id')->get()->map([$this, 'flatten']);
    }

    public function store(Request $request, $type)
    {
        $payload = $request->all();
        $row = Master::create([
            'type' => $type,
            'code' => $payload['code'] ?? null,
            'name' => $payload['name'] ?? ($payload['text'] ?? null),
            'status' => $payload['status'] ?? 'Active',
            'data' => $this->extra($payload),
        ]);

        return response()->json($this->flatten($row), 201);
    }

    public function update(Request $request, $type, Master $master)
    {
        $payload = $request->all();
        $master->update([
            'code' => $payload['code'] ?? $master->code,
            'name' => $payload['name'] ?? ($payload['text'] ?? $master->name),
            'status' => $payload['status'] ?? $master->status,
            'data' => array_merge($master->data ?? [], $this->extra($payload)),
        ]);

        return $this->flatten($master);
    }

    public function destroy($type, Master $master)
    {
        $master->delete();

        return response()->noContent();
    }

    /** Merge JSON data fields back up to the top level for the front-end. */
    public function flatten(Master $m)
    {
        return array_merge(
            ['id' => $m->id, 'code' => $m->code, 'name' => $m->name, 'status' => $m->status],
            $m->data ?? []
        );
    }

    /** Pull non-reserved fields into the data bag. */
    private function extra(array $payload): array
    {
        return collect($payload)->except($this->reserved)->all();
    }
}
