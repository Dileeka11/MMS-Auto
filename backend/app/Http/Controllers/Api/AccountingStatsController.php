<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;

use App\Models\Account;
use App\Models\AccountCategory;
use App\Models\AccountGroup;
use App\Models\JournalEntry;

/**
 * Dashboard aggregates for the Accounting module — counts used by the Chart of
 * Accounts header and any summary cards.
 */
class AccountingStatsController extends Controller
{
    public function index()
    {
        return response()->json([
            'categories' => AccountCategory::count(),
            'groups' => AccountGroup::count(),
            'accounts' => Account::count(),
            'active_accounts' => Account::where('is_active', true)->count(),
            'journal_entries' => JournalEntry::count(),
        ]);
    }
}
