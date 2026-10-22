<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;

use App\Models\Account;
use App\Models\AccountMapping;
use App\Models\JournalEntry;
use App\Services\Accounting\Posting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Posting Setup — which ledger account each auto-posting role uses, plus a
 * "re-post everything" action to backfill / refresh the ledger from the ERP
 * documents.
 */
class AccountMappingController extends Controller
{
    /** Every role with its effective account and any problem that would block posting. */
    public function index()
    {
        $effective = Posting::roleAccountIds();
        $explicit = AccountMapping::whereNotNull('account_id')->pluck('account_id', 'key');
        $accounts = Account::whereIn('id', array_filter($effective))->withCount('children')->get()->keyBy('id');

        $roles = [];
        foreach (Posting::ROLES as $key => [$label, $defaultCode, $usage]) {
            $account = $effective[$key] ? $accounts->get($effective[$key]) : null;
            $problem = null;
            if (! $account) {
                $problem = 'No account set — documents using this role cannot be posted.';
            } elseif (! $account->is_active) {
                $problem = 'Account is inactive.';
            } elseif ($account->children_count > 0) {
                $problem = 'Account is a header (has sub-accounts) and cannot be posted to.';
            }

            $roles[] = [
                'key' => $key,
                'label' => $label,
                'usage' => $usage,
                'default_code' => $defaultCode,
                'account_id' => $account ? $account->id : null,
                'account_code' => $account ? $account->code : null,
                'account_name' => $account ? $account->name : null,
                'is_default' => ! isset($explicit[$key]),
                'problem' => $problem,
            ];
        }

        $counts = JournalEntry::query()
            ->select('source_type', DB::raw('COUNT(*) as n'))
            ->groupBy('source_type')
            ->pluck('n', 'source_type');

        return response()->json([
            'roles' => $roles,
            'posted' => collect(Posting::SOURCE_LABELS)->map(function ($label, $type) use ($counts) {
                return ['type' => $type, 'label' => $label, 'entries' => (int) ($counts[$type] ?? 0)];
            })->values()->push(['type' => 'manual', 'label' => 'Manual', 'entries' => (int) ($counts[''] ?? 0)]),
        ]);
    }

    /** Body: { "mappings": [{ "key": "receivable", "account_id": 12 }, …] } */
    public function update(Request $request)
    {
        $data = $request->validate([
            'mappings' => ['required', 'array'],
            'mappings.*.key' => ['required', 'string', 'in:' . implode(',', array_keys(Posting::ROLES))],
            'mappings.*.account_id' => ['required', 'integer', 'exists:accounts,id'],
        ]);

        $accounts = Account::whereIn('id', collect($data['mappings'])->pluck('account_id'))->get()->keyBy('id');
        foreach ($data['mappings'] as $m) {
            $account = $accounts->get($m['account_id']);
            if (! Posting::isPostable($account)) {
                throw ValidationException::withMessages([
                    'mappings' => Posting::ROLES[$m['key']][0] . ": {$account->code} · {$account->name} is inactive or a header account.",
                ]);
            }
        }

        DB::transaction(function () use ($data) {
            foreach ($data['mappings'] as $m) {
                AccountMapping::updateOrCreate(['key' => $m['key']], ['account_id' => $m['account_id']]);
            }
        });
        Posting::flush();

        return $this->index();
    }

    /** POST /accounting/posting/rebuild — re-post every ERP document. */
    public function rebuild()
    {
        @set_time_limit(300);

        return response()->json(Posting::rebuild());
    }
}
