<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;

use App\Models\Account;
use App\Services\Accounting\Posting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * General Ledger for one account over a date range: opening balance (net of
 * everything before `from`), each posting line with a running balance, and
 * closing totals.
 */
class GeneralLedgerController extends Controller
{
    public function index(Request $request)
    {
        $data = $request->validate([
            'account_id' => ['required', 'integer'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $account = Account::query()
            ->join('account_groups as g', 'g.id', '=', 'accounts.group_id')
            ->join('account_categories as c', 'c.id', '=', 'g.category_id')
            ->where('accounts.id', $data['account_id'])
            ->first(['accounts.id', 'accounts.code', 'accounts.name', 'c.normal_balance']);

        if (! $account) {
            return response()->json(['message' => 'Account not found.'], 404);
        }

        $from = $data['from'] ?? null;
        $to = $data['to'] ?? null;

        // A header account's ledger is the combined ledger of its whole sub-tree.
        $ids = $this->subtree($account->id);

        // Opening balance = net (debit - credit) of everything before `from`.
        $opening = 0.0;
        if ($from) {
            $opening = (float) DB::table('journal_lines as l')
                ->join('journal_entries as e', 'e.id', '=', 'l.entry_id')
                ->whereIn('l.account_id', $ids)
                ->where('e.entry_date', '<', $from)
                ->sum(DB::raw('l.debit - l.credit'));
        }

        $rows = DB::table('journal_lines as l')
            ->join('journal_entries as e', 'e.id', '=', 'l.entry_id')
            ->whereIn('l.account_id', $ids)
            ->when($from, fn ($q) => $q->where('e.entry_date', '>=', $from))
            ->when($to, fn ($q) => $q->where('e.entry_date', '<=', $to))
            ->orderBy('e.entry_date')
            ->orderBy('e.id')
            ->orderBy('l.id')
            ->get(['e.id as entry_id', 'e.entry_date', 'e.reference', 'e.source_type', 'e.memo as entry_memo', 'l.debit', 'l.credit', 'l.memo']);

        $balance = $opening;
        $totalDebit = 0.0;
        $totalCredit = 0.0;
        $lines = [];
        foreach ($rows as $r) {
            $debit = (float) $r->debit;
            $credit = (float) $r->credit;
            $balance += $debit - $credit;
            $totalDebit += $debit;
            $totalCredit += $credit;
            $lines[] = [
                'entry_id' => (int) $r->entry_id,
                'doc_no' => 'JE-' . str_pad((string) $r->entry_id, 6, '0', STR_PAD_LEFT),
                'date' => $r->entry_date,
                'reference' => $r->reference,
                'source' => Posting::SOURCE_LABELS[$r->source_type] ?? 'Manual',
                'memo' => $r->memo ?: $r->entry_memo,
                'debit' => round($debit, 2),
                'credit' => round($credit, 2),
                'balance' => round($balance, 2),
            ];
        }

        return response()->json([
            'account' => $account,
            'opening_balance' => round($opening, 2),
            'lines' => $lines,
            'total_debit' => round($totalDebit, 2),
            'total_credit' => round($totalCredit, 2),
            'closing_balance' => round($balance, 2),
        ]);
    }

    /** The account id plus every descendant id. */
    private function subtree(int $id): array
    {
        $ids = [$id];
        $frontier = [$id];
        while ($frontier) {
            $frontier = Account::whereIn('parent_id', $frontier)->pluck('id')->all();
            $ids = array_merge($ids, $frontier);
        }

        return $ids;
    }
}
