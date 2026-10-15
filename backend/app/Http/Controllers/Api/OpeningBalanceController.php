<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;

use App\Models\Account;
use App\Models\FinancialYear;
use App\Models\OpeningBalance;
use Illuminate\Http\Request;

class OpeningBalanceController extends Controller
{
    /**
     * GET /accounting/financial-years/{id}/opening-balances
     *
     * Returns all accounts in a tree-friendly flat list with the opening
     * balance (debit/credit) for the requested financial year pre-filled.
     */
    public function index(FinancialYear $financialYear)
    {
        // Load all active accounts with their group + category.
        $accounts = Account::with(['group.category'])
            ->orderBy('code')
            ->get(['id', 'code', 'name', 'group_id', 'parent_id', 'is_active']);

        // Index the existing opening balances for this year.
        $balances = OpeningBalance::where('financial_year_id', $financialYear->id)
            ->get()
            ->keyBy('account_id');

        $result = $accounts->map(function (Account $account) use ($balances, $financialYear) {
            $ob = $balances->get($account->id);
            return [
                'account_id'       => $account->id,
                'account_code'     => $account->code,
                'account_name'     => $account->name,
                'group_id'         => $account->group_id,
                'group_name'       => optional($account->group)->name,
                'category_name'    => optional(optional($account->group)->category)->name,
                'parent_id'        => $account->parent_id,
                'financial_year_id'=> $financialYear->id,
                'debit'            => $ob ? $ob->debit : '0.00',
                'credit'           => $ob ? $ob->credit : '0.00',
            ];
        });

        return response()->json([
            'financial_year' => $financialYear,
            'accounts'       => $result,
        ]);
    }

    /**
     * POST /accounting/financial-years/{id}/opening-balances
     *
     * Bulk upsert opening balances for all accounts in a given year.
     *
     * Body: { "balances": [{ "account_id": 1, "debit": "500.00", "credit": "0.00" }, ...] }
     */
    public function store(Request $request, FinancialYear $financialYear)
    {
        $request->validate([
            'balances'               => ['required', 'array'],
            'balances.*.account_id'  => ['required', 'integer', 'exists:accounts,id'],
            'balances.*.debit'       => ['nullable', 'numeric', 'min:0'],
            'balances.*.credit'      => ['nullable', 'numeric', 'min:0'],
        ]);

        $now = now();
        $saved = 0;

        foreach ($request->balances as $row) {
            $debit  = (float) ($row['debit']  ?? 0);
            $credit = (float) ($row['credit'] ?? 0);

            // Skip rows where both are zero — clean up any existing record.
            if ($debit == 0 && $credit == 0) {
                OpeningBalance::where('financial_year_id', $financialYear->id)
                    ->where('account_id', $row['account_id'])
                    ->delete();
                continue;
            }

            OpeningBalance::updateOrCreate(
                [
                    'financial_year_id' => $financialYear->id,
                    'account_id'        => $row['account_id'],
                ],
                [
                    'debit'      => $debit,
                    'credit'     => $credit,
                    'updated_at' => $now,
                ]
            );
            $saved++;
        }

        return response()->json(['message' => "Opening balances saved ({$saved} records)."]);
    }
}
