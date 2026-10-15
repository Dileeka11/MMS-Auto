<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;

use App\Models\AccountGroup;
use Illuminate\Http\Request;

/**
 * Account groups (Current Assets, Long Term Liabilities, …) — the middle tier
 * of the chart, each belonging to one category.
 */
class AccountGroupController extends Controller
{
    /** List groups joined up to their category, with account counts. */
    public function index()
    {
        return AccountGroup::query()
            ->with('category:id,code,name,normal_balance,statement_type')
            ->withCount('accounts')
            ->orderBy('code')
            ->get();
    }

    // Groups (and categories) are the fixed skeleton of the chart. Users build
    // their tree with accounts/sub-accounts underneath; the skeleton is locked.
    public function store(Request $request)
    {
        abort(403, 'Account groups are fixed and cannot be changed.');
    }

    public function update(Request $request, AccountGroup $accountGroup)
    {
        abort(403, 'Account groups are fixed and cannot be changed.');
    }

    public function destroy(AccountGroup $accountGroup)
    {
        abort(403, 'Account groups are fixed and cannot be changed.');
    }
}
