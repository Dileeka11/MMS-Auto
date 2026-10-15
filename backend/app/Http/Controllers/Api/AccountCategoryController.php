<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;

use App\Models\AccountCategory;
use Illuminate\Http\Request;

/**
 * Top-level chart categories (Assets, Liabilities, Equity, Income, Expenses).
 * normal_balance encodes double-entry rules: Assets/Expenses are debit,
 * Liabilities/Equity/Income are credit.
 */
class AccountCategoryController extends Controller
{
    /** List all categories (by code) with their group + account counts. */
    public function index()
    {
        return AccountCategory::withCount(['groups'])
            ->orderBy('code')
            ->get();
    }

    /** Categories with their nested groups — for chart dropdowns. */
    public function chart()
    {
        return AccountCategory::with(['groups' => fn ($q) => $q->orderBy('code')])
            ->orderBy('code')
            ->get();
    }

    // Categories (and groups) are the fixed skeleton of the chart. Users build
    // their tree with accounts/sub-accounts underneath; the skeleton is locked.
    public function store(Request $request)
    {
        abort(403, 'Account categories are fixed and cannot be changed.');
    }

    public function update(Request $request, AccountCategory $accountCategory)
    {
        abort(403, 'Account categories are fixed and cannot be changed.');
    }

    public function destroy(AccountCategory $accountCategory)
    {
        abort(403, 'Account categories are fixed and cannot be changed.');
    }
}
