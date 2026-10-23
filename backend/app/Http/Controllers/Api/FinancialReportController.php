<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;

use App\Services\Accounting\Ledger;
use Illuminate\Http\Request;

/** Financial statements built from the general ledger. */
class FinancialReportController extends Controller
{
    /** GET /accounting/profit-loss?from=&to= */
    public function profitLoss(Request $request)
    {
        $data = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        return response()->json(Ledger::profitLoss($data['from'] ?? null, $data['to'] ?? null));
    }

    /** GET /accounting/balance-sheet?as_of= */
    public function balanceSheet(Request $request)
    {
        $data = $request->validate([
            'as_of' => ['nullable', 'date'],
        ]);

        return response()->json(Ledger::balanceSheet($data['as_of'] ?? now()->toDateString()));
    }
}
