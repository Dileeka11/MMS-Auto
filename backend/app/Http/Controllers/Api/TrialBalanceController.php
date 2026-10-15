<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Trial Balance — the first sanity check of the engine: total debits must equal
 * total credits. One row per account with a non-zero movement, plus grand
 * totals and a `balanced` flag.
 */
class TrialBalanceController extends Controller
{
    public function index(Request $request)
    {
        $data = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $from = $data['from'] ?? null;
        $to = $data['to'] ?? null;

        $accounts = DB::table('journal_lines as l')
            ->join('journal_entries as e', 'e.id', '=', 'l.entry_id')
            ->join('accounts as a', 'a.id', '=', 'l.account_id')
            ->when($from, fn ($q) => $q->where('e.entry_date', '>=', $from))
            ->when($to, fn ($q) => $q->where('e.entry_date', '<=', $to))
            ->groupBy('a.id', 'a.code', 'a.name')
            ->havingRaw('SUM(l.debit) <> 0 OR SUM(l.credit) <> 0')
            ->orderBy('a.code')
            ->get([
                'a.code',
                'a.name',
                DB::raw('SUM(l.debit) as total_dr'),
                DB::raw('SUM(l.credit) as total_cr'),
            ]);

        $rows = [];
        $totalDebit = 0.0;
        $totalCredit = 0.0;
        foreach ($accounts as $r) {
            // Show each account on its net side, the usual Trial Balance layout.
            $net = (float) $r->total_dr - (float) $r->total_cr;
            $debit = $net > 0 ? $net : 0.0;
            $credit = $net < 0 ? -$net : 0.0;
            $totalDebit += $debit;
            $totalCredit += $credit;
            $rows[] = [
                'code' => $r->code,
                'name' => $r->name,
                'debit' => round($debit, 2),
                'credit' => round($credit, 2),
            ];
        }

        return response()->json([
            'from' => $from,
            'to' => $to,
            'rows' => $rows,
            'total_debit' => round($totalDebit, 2),
            'total_credit' => round($totalCredit, 2),
            'balanced' => round($totalDebit * 100) === round($totalCredit * 100),
        ]);
    }
}
