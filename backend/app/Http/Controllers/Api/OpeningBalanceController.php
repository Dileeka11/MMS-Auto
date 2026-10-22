<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;

use App\Models\Account;
use App\Models\FinancialYear;
use App\Models\OpeningBalance;
use App\Services\Accounting\Posting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

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
        // Load all accounts with their group + category.
        $accounts = Account::with(['group.category'])
            ->withCount('children')
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
                'is_header'        => $account->children_count > 0,
                'normal_balance'   => optional(optional($account->group)->category)->normal_balance,
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

        $accounts = Account::whereIn('id', collect($request->balances)->pluck('account_id'))
            ->withCount('children')->get()->keyBy('id');

        // Rows are checked before anything is written: one side per account,
        // header accounts carry no balance of their own, and the set balances.
        $totalDebit = 0;
        $totalCredit = 0;
        foreach ($request->balances as $row) {
            $debit = (int) round(((float) ($row['debit'] ?? 0)) * 100);
            $credit = (int) round(((float) ($row['credit'] ?? 0)) * 100);
            if ($debit === 0 && $credit === 0) {
                continue;
            }
            $acc = $accounts->get($row['account_id']);
            if ($debit > 0 && $credit > 0) {
                throw ValidationException::withMessages(['balances' => "{$acc->code} · {$acc->name}: enter either a debit or a credit, not both."]);
            }
            if ($acc->children_count > 0) {
                throw ValidationException::withMessages(['balances' => "{$acc->code} · {$acc->name} is a header account — enter the balance on its sub-accounts."]);
            }
            $totalDebit += $debit;
            $totalCredit += $credit;
        }
        if ($totalDebit !== $totalCredit) {
            throw ValidationException::withMessages([
                'balances' => sprintf('Opening balances are not balanced. Debit %.2f ≠ Credit %.2f.', $totalDebit / 100, $totalCredit / 100),
            ]);
        }

        $saved = DB::transaction(function () use ($request, $financialYear) {
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
                    ]
                );
                $saved++;
            }

            // Opening balances reach the GL / Trial Balance as one journal on the year's start date.
            Posting::openingBalances($financialYear);

            return $saved;
        });

        return response()->json(['message' => "Opening balances saved ({$saved} records)."]);
    }
}
