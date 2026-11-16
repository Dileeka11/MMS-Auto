<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Quotation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class QuotationController extends Controller
{
    public function index()
    {
        Quotation::expireStale();

        return Quotation::with('lines')->orderByDesc('id')->get();
    }

    public function show(Quotation $quotation)
    {
        Quotation::expireStale();

        return $quotation->refresh()->load('lines');
    }

    public function store(Request $request)
    {
        $data = $request->validate($this->rules(true) + [
            'date' => 'nullable|date',
        ]);
        $date = $data['date'] ?? now()->toDateString();
        $this->assertValidity($date, $data['valid_until'] ?? null);

        return DB::transaction(function () use ($data, $date) {
            $q = Quotation::create([
                'code' => 'QT-' . (9100 + Quotation::count() + 1),
                'customer' => $data['customer'],
                'rep' => $data['rep'] ?? null,
                'date' => $date,
                'valid_until' => $data['valid_until'] ?? null,
                'total' => $this->totalOf($data['lines']),
                'items' => count($data['lines']),
                'status' => Quotation::OPEN,
                'cost' => '-',
            ]);
            $this->writeLines($q, $data['lines']);

            return response()->json($q->load('lines'), 201);
        });
    }

    /**
     * Edit a quotation while it is still Open. Lines, when sent, replace the
     * existing ones and the total is recalculated. Converted and Expired
     * quotations are locked: issue a new quotation instead.
     */
    public function update(Request $request, Quotation $quotation)
    {
        $data = $request->validate($this->rules(false));

        return DB::transaction(function () use ($data, $quotation) {
            $quotation = Quotation::whereKey($quotation->id)->lockForUpdate()->firstOrFail();
            if (! $quotation->isOpen()) {
                throw ValidationException::withMessages([
                    'status' => "Quotation {$quotation->code} is {$quotation->status} and can no longer be edited. Create a new quotation instead.",
                ]);
            }
            $validUntil = array_key_exists('valid_until', $data) ? $data['valid_until'] : optional($quotation->valid_until)->toDateString();
            $this->assertValidity($quotation->date->toDateString(), $validUntil);

            $quotation->fill(array_intersect_key($data, array_flip(['customer', 'rep', 'valid_until'])));
            if (isset($data['lines'])) {
                $quotation->lines()->delete();
                $this->writeLines($quotation, $data['lines']);
                $quotation->total = $this->totalOf($data['lines']);
                $quotation->items = count($data['lines']);
            }
            $quotation->save();

            return $quotation->load('lines');
        });
    }

    public function destroy(Quotation $quotation)
    {
        $quotation->delete();

        return response()->noContent();
    }

    private function rules(bool $creating): array
    {
        $req = $creating ? 'required' : 'sometimes';

        return [
            'customer' => "$req|string",
            'rep' => 'nullable|string',
            'valid_until' => 'nullable|date',
            'lines' => "$req|array|min:1",
            'lines.*.code' => 'nullable|string',
            'lines.*.name' => 'required|string',
            'lines.*.qty' => 'required|integer|min:1',
            'lines.*.rate' => 'required|numeric|min:0',
        ];
    }

    private function assertValidity(string $date, ?string $validUntil): void
    {
        if ($validUntil && $validUntil < $date) {
            throw ValidationException::withMessages(['valid_until' => 'Valid Until cannot be before the quotation date.']);
        }
    }

    private function totalOf(array $lines): float
    {
        return round(collect($lines)->sum(function ($l) {
            return $l['qty'] * $l['rate'];
        }), 2);
    }

    private function writeLines(Quotation $q, array $lines): void
    {
        foreach ($lines as $l) {
            $q->lines()->create([
                'code' => $l['code'] ?? null,
                'name' => $l['name'],
                'qty' => $l['qty'],
                'rate' => $l['rate'],
            ]);
        }
    }
}
