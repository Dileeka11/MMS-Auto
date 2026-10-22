<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;

use App\Models\Account;
use App\Models\FinancialYear;
use App\Models\JournalEntry;
use App\Models\JournalLine;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Manual Journal Entry API. An entry is only accepted when total debits equal
 * total credits and the total is greater than zero (double-entry). The header
 * and lines are written inside a DB transaction so a partial entry can never
 * be saved.
 */
class JournalEntryController extends Controller
{
    /**
     * List posted entries (newest first) with their lines. Auto-posting makes
     * this grow with every document, so it is filterable by date range and
     * source (`manual` = hand-posted vouchers) and capped at `limit` rows.
     */
    public function index(Request $request)
    {
        $data = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'source' => ['nullable', 'string', 'max:40'],
            'search' => ['nullable', 'string', 'max:100'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:2000'],
        ]);
        $source = $data['source'] ?? null;

        return JournalEntry::query()
            ->with(['lines' => fn ($q) => $q
                ->join('accounts as a', 'a.id', '=', 'journal_lines.account_id')
                ->orderBy('journal_lines.id')
                ->select('journal_lines.*', 'a.code as account_code', 'a.name as account_name')])
            ->when($data['from'] ?? null, fn ($q, $v) => $q->where('entry_date', '>=', $v))
            ->when($data['to'] ?? null, fn ($q, $v) => $q->where('entry_date', '<=', $v))
            ->when($source === 'manual', fn ($q) => $q->whereNull('source_type'))
            ->when($source && $source !== 'manual', fn ($q) => $q->where('source_type', $source))
            ->when($data['search'] ?? null, fn ($q, $v) => $q->where(fn ($w) => $w
                ->where('reference', 'like', "%{$v}%")
                ->orWhere('memo', 'like', "%{$v}%")))
            ->orderByDesc('entry_date')
            ->orderByDesc('id')
            ->limit($data['limit'] ?? 500)
            ->get();
    }

    /** Show one entry with its lines. */
    public function show(JournalEntry $journalEntry)
    {
        $journalEntry->load(['lines' => fn ($q) => $q
            ->join('accounts as a', 'a.id', '=', 'journal_lines.account_id')
            ->orderBy('journal_lines.id')
            ->select('journal_lines.*', 'a.code as account_code', 'a.name as account_name')]);

        return response()->json($journalEntry);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'entry_date' => ['required', 'date'],
            'posting_date' => ['nullable', 'date'],
            'reference' => ['nullable', 'string', 'max:50'],
            'currency' => ['nullable', 'string', 'max:10'],
            'branch' => ['nullable', 'string', 'max:100'],
            'memo' => ['nullable', 'string', 'max:255'],
            'lines' => ['required', 'array', 'min:2'],
            'lines.*.account_id' => ['required', 'integer'],
            'lines.*.dr_cr' => ['required', 'in:debit,credit'],
            'lines.*.amount' => ['required', 'numeric', 'gt:0'],
            'lines.*.memo' => ['nullable', 'string', 'max:255'],
        ]);

        // Confirm every referenced account exists, is active and is a leaf.
        $ids = collect($data['lines'])->pluck('account_id')->unique()->values();
        $accounts = Account::whereIn('id', $ids)->withCount('children')->get()->keyBy('id');
        foreach ($ids as $id) {
            $acc = $accounts->get($id);
            if (! $acc) {
                throw ValidationException::withMessages(['lines' => "Account #{$id} does not exist."]);
            }
            if (! $acc->is_active) {
                throw ValidationException::withMessages(['lines' => "Account \"{$acc->name}\" is inactive and cannot be posted to."]);
            }
            if ($acc->children_count > 0) {
                throw ValidationException::withMessages(['lines' => "Account \"{$acc->name}\" is a header account — post to one of its sub-accounts."]);
            }
        }

        // Every voucher belongs to a defined financial year.
        $year = FinancialYear::forDate($data['entry_date']);
        if (! $year) {
            throw ValidationException::withMessages([
                'entry_date' => 'The document date is not inside any financial year. Add the year in Accounting → Financial Year first.',
            ]);
        }

        // Balance check — compare in integer cents to dodge float rounding.
        $totalDebit = 0.0;
        $totalCredit = 0.0;
        foreach ($data['lines'] as $line) {
            if ($line['dr_cr'] === 'debit') {
                $totalDebit += (float) $line['amount'];
            } else {
                $totalCredit += (float) $line['amount'];
            }
        }
        if (round($totalDebit * 100) !== round($totalCredit * 100)) {
            throw ValidationException::withMessages([
                'lines' => sprintf('Entry is not balanced. Debit %.2f ≠ Credit %.2f.', $totalDebit, $totalCredit),
            ]);
        }

        $entry = DB::transaction(function () use ($data, $year) {
            $entry = JournalEntry::create([
                'financial_year_id' => $year->id,
                'entry_date' => $data['entry_date'],
                'posting_date' => $data['posting_date'] ?? $data['entry_date'],
                'reference' => $data['reference'] ?? null,
                'currency' => $data['currency'] ?? 'LKR',
                'branch' => $data['branch'] ?? null,
                'memo' => $data['memo'] ?? null,
            ]);

            foreach ($data['lines'] as $line) {
                $debit = $line['dr_cr'] === 'debit' ? (float) $line['amount'] : 0;
                $credit = $line['dr_cr'] === 'credit' ? (float) $line['amount'] : 0;
                JournalLine::create([
                    'entry_id' => $entry->id,
                    'account_id' => $line['account_id'],
                    'debit' => $debit,
                    'credit' => $credit,
                    'memo' => $line['memo'] ?? null,
                ]);
            }

            return $entry;
        });

        return response()->json($entry->load('lines'), 201);
    }

    /**
     * Delete a manual voucher. Auto-posted entries belong to their ERP
     * document — they change or go away with that document, never by hand.
     */
    public function destroy(JournalEntry $journalEntry)
    {
        if ($journalEntry->source_type !== null) {
            return response()->json([
                'message' => "This entry was posted automatically from {$journalEntry->source_label} {$journalEntry->reference}. Change or delete that document instead.",
            ], 409);
        }

        DB::transaction(function () use ($journalEntry) {
            $journalEntry->lines()->delete();
            $journalEntry->delete();
        });

        return response()->json(['message' => 'Deleted.']);
    }
}
