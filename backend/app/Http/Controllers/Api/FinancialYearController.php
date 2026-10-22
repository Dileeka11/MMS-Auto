<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;

use App\Models\FinancialYear;
use App\Models\JournalEntry;
use App\Models\OpeningBalance;
use App\Services\Accounting\Posting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class FinancialYearController extends Controller
{
    /** GET /accounting/financial-years — list all years */
    public function index()
    {
        return FinancialYear::orderBy('start_date', 'desc')->get();
    }

    /** POST /accounting/financial-years — create a new financial year */
    public function store(Request $request)
    {
        $data = $request->validate([
            'year_name'  => ['required', 'string', 'max:20', 'unique:financial_years,year_name'],
            'start_date' => ['required', 'date'],
            'end_date'   => ['required', 'date', 'after:start_date'],
            'is_active'  => ['nullable', 'boolean'],
        ]);
        $this->assertNoOverlap($data['start_date'], $data['end_date']);

        $year = DB::transaction(function () use ($data) {
            // If the new year is set as active, deactivate all others.
            if (!empty($data['is_active'])) {
                FinancialYear::where('is_active', true)->update(['is_active' => false]);
            }

            $year = FinancialYear::create($data);
            $this->relinkEntries();

            return $year;
        });

        return response()->json($year, 201);
    }

    /** PUT /accounting/financial-years/{id} — update a financial year */
    public function update(Request $request, FinancialYear $financialYear)
    {
        $data = $request->validate([
            'year_name'  => ['sometimes', 'required', 'string', 'max:20',
                             "unique:financial_years,year_name,{$financialYear->id}"],
            'start_date' => ['sometimes', 'required', 'date'],
            'end_date'   => ['sometimes', 'required', 'date'],
            'is_active'  => ['nullable', 'boolean'],
        ]);

        // Check the resulting range, not just the fields that were sent.
        $start = $data['start_date'] ?? $financialYear->start_date->toDateString();
        $end = $data['end_date'] ?? $financialYear->end_date->toDateString();
        if ($end <= $start) {
            throw ValidationException::withMessages(['end_date' => 'The end date must be after the start date.']);
        }
        $this->assertNoOverlap($start, $end, $financialYear->id);

        DB::transaction(function () use ($data, $financialYear) {
            // Activating this year → deactivate all others first.
            if (!empty($data['is_active'])) {
                FinancialYear::where('id', '!=', $financialYear->id)
                    ->where('is_active', true)
                    ->update(['is_active' => false]);
            }

            $financialYear->update($data);
            // A moved start date moves the opening-balance journal with it.
            Posting::openingBalances($financialYear);
            $this->relinkEntries();
        });

        return response()->json($financialYear);
    }

    /** DELETE /accounting/financial-years/{id} — delete a financial year */
    public function destroy(FinancialYear $financialYear)
    {
        if ($financialYear->is_active) {
            return response()->json(['message' => 'Cannot delete the active financial year.'], 422);
        }

        $posted = JournalEntry::where('financial_year_id', $financialYear->id)
            ->where(fn ($q) => $q->whereNull('source_type')->orWhere('source_type', '!=', Posting::OPENING_BALANCE))
            ->count();
        if ($posted > 0) {
            return response()->json([
                'message' => "Cannot delete: {$posted} journal entries are dated in this financial year.",
            ], 409);
        }

        DB::transaction(function () use ($financialYear) {
            Posting::remove(Posting::OPENING_BALANCE, $financialYear->id);
            OpeningBalance::where('financial_year_id', $financialYear->id)->delete();
            $financialYear->delete();
        });

        return response()->json(['message' => 'Deleted.']);
    }

    /** POST /accounting/financial-years/{id}/set-active — set as current year */
    public function setActive(FinancialYear $financialYear)
    {
        FinancialYear::where('is_active', true)->update(['is_active' => false]);
        $financialYear->update(['is_active' => true]);

        return response()->json($financialYear);
    }

    /** Years may not overlap — every date must belong to exactly one year. */
    private function assertNoOverlap(string $start, string $end, ?int $exceptId = null): void
    {
        $clash = FinancialYear::where('start_date', '<=', $end)
            ->where('end_date', '>=', $start)
            ->when($exceptId, fn ($q) => $q->where('id', '!=', $exceptId))
            ->first();

        if ($clash) {
            throw ValidationException::withMessages([
                'start_date' => "These dates overlap financial year {$clash->year_name} ({$clash->start_date->toDateString()} → {$clash->end_date->toDateString()}).",
            ]);
        }
    }

    /** Re-stamp journal entries with the year that now contains their date. */
    private function relinkEntries(): void
    {
        JournalEntry::query()->update(['financial_year_id' => null]);
        foreach (FinancialYear::all() as $year) {
            JournalEntry::whereBetween('entry_date', [$year->start_date->toDateString(), $year->end_date->toDateString()])
                ->update(['financial_year_id' => $year->id]);
        }
    }
}
