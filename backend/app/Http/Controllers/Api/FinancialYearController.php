<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;

use App\Models\FinancialYear;
use Illuminate\Http\Request;

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

        // If the new year is set as active, deactivate all others.
        if (!empty($data['is_active'])) {
            FinancialYear::where('is_active', true)->update(['is_active' => false]);
        }

        $year = FinancialYear::create($data);

        return response()->json($year, 201);
    }

    /** PUT /accounting/financial-years/{id} — update a financial year */
    public function update(Request $request, FinancialYear $financialYear)
    {
        $data = $request->validate([
            'year_name'  => ['sometimes', 'required', 'string', 'max:20',
                             "unique:financial_years,year_name,{$financialYear->id}"],
            'start_date' => ['sometimes', 'required', 'date'],
            'end_date'   => ['sometimes', 'required', 'date', 'after:start_date'],
            'is_active'  => ['nullable', 'boolean'],
        ]);

        // Activating this year → deactivate all others first.
        if (!empty($data['is_active'])) {
            FinancialYear::where('id', '!=', $financialYear->id)
                ->where('is_active', true)
                ->update(['is_active' => false]);
        }

        $financialYear->update($data);

        return response()->json($financialYear);
    }

    /** DELETE /accounting/financial-years/{id} — delete a financial year */
    public function destroy(FinancialYear $financialYear)
    {
        if ($financialYear->is_active) {
            return response()->json(['message' => 'Cannot delete the active financial year.'], 422);
        }

        $financialYear->delete();

        return response()->json(['message' => 'Deleted.']);
    }

    /** POST /accounting/financial-years/{id}/set-active — set as current year */
    public function setActive(FinancialYear $financialYear)
    {
        FinancialYear::where('is_active', true)->update(['is_active' => false]);
        $financialYear->update(['is_active' => true]);

        return response()->json($financialYear);
    }
}
