<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;

use App\Models\Account;
use App\Models\AccountGroup;
use App\Models\OpeningBalance;
use App\Services\Accounting\Posting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Individual GL accounts — the "Chart of Accounts" screen. The chart is a tree:
 * a top-level account belongs to a group (parent_id NULL); a sub-account nests
 * under another account and inherits its group. Codes are always system
 * generated (never user-editable). An account that has children is a "header"
 * and is not postable — only leaf accounts may be used in journal entries.
 */
class AccountController extends Controller
{
    /** Flat chart list, each row joined up to group + category + statement type. */
    public function index()
    {
        return Account::query()
            ->join('account_groups as g', 'g.id', '=', 'accounts.group_id')
            ->join('account_categories as c', 'c.id', '=', 'g.category_id')
            ->orderBy('accounts.code')
            ->get([
                'accounts.id',
                'accounts.code',
                'accounts.name',
                'accounts.is_active',
                'accounts.is_default',
                'accounts.is_cashbook',
                'accounts.created_by',
                'accounts.group_id',
                'accounts.parent_id',
                'g.name as group_name',
                'g.code as group_code',
                'c.id as category_id',
                'c.name as category_name',
                'c.statement_type as type',
                // has_children drives the header/postable distinction on the client.
                DB::raw('EXISTS(SELECT 1 FROM accounts AS ch WHERE ch.parent_id = accounts.id) AS has_children'),
            ])
            ->map(function ($r) {
                $r->is_active = (bool) $r->is_active;
                $r->is_default = (bool) $r->is_default;
                $r->is_cashbook = (bool) $r->is_cashbook;
                $r->has_children = (bool) $r->has_children;
                $r->is_postable = ! $r->has_children; // only leaves can be posted to
                return $r;
            });
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'group_id' => ['nullable', 'integer', 'exists:account_groups,id'],
            'parent_id' => ['nullable', 'integer', 'exists:accounts,id'],
            'name' => ['required', 'string', 'max:150'],
            'is_active' => ['nullable', 'boolean'],
            'is_cashbook' => ['nullable', 'boolean'],
        ]);

        // A sub-account inherits its parent's group and gets a parent-derived code.
        // A top-level account needs a group and gets a group-derived code.
        if (! empty($data['parent_id'])) {
            $parent = Account::findOrFail($data['parent_id']);
            // A parent becomes a non-postable header — not allowed once it
            // carries postings of its own or is an auto-posting account.
            if ($blocker = $this->postingUse($parent)) {
                return response()->json([
                    'message' => "Cannot add a sub-account under {$parent->code} · {$parent->name}: it {$blocker}.",
                ], 409);
            }
            $groupId = $parent->group_id;
            $code = $this->nextChildCode($parent);
            $parentId = $parent->id;
        } else {
            if (empty($data['group_id'])) {
                return response()->json(['message' => 'A group is required for a top-level account.'], 422);
            }
            $group = AccountGroup::findOrFail($data['group_id']);
            $groupId = $group->id;
            $code = $this->nextAccountCode($group);
            $parentId = null;
        }

        $account = Account::create([
            'group_id' => $groupId,
            'parent_id' => $parentId,
            'code' => $code,
            'name' => $data['name'],
            'is_active' => $data['is_active'] ?? true,
            'is_default' => false,
            'is_cashbook' => (bool) ($data['is_cashbook'] ?? false),
            'created_by' => 'admin',
        ]);

        return response()->json($account, 201);
    }

    /**
     * Only the name and active flag are editable. Codes are system-generated and
     * locked; group/parent moves are out of scope so the tree stays consistent.
     */
    public function update(Request $request, Account $account)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'is_active' => ['nullable', 'boolean'],
            'is_cashbook' => ['nullable', 'boolean'],
        ]);

        $cashbook = $data['is_cashbook'] ?? $account->is_cashbook;
        if ($cashbook && $account->children()->exists()) {
            return response()->json(['message' => 'A header account cannot be a Cash Book account — flag its sub-accounts instead.'], 422);
        }

        $active = $data['is_active'] ?? $account->is_active;
        if (! $active && $account->is_active && in_array($account->id, Posting::roleAccountIds(), true)) {
            return response()->json([
                'message' => 'Cannot deactivate: this account is used for auto-posting. Change it in Accounting → Posting Setup first.',
            ], 409);
        }

        $account->update([
            'name' => $data['name'],
            'is_active' => $active,
            'is_cashbook' => $cashbook,
        ]);

        return response()->json($account);
    }

    public function destroy(Account $account)
    {
        // A header account owns sub-accounts; deleting it would orphan them.
        if ($account->children()->exists()) {
            return response()->json([
                'message' => 'Cannot delete: this account has sub-accounts. Remove those first.',
            ], 409);
        }

        // journal_lines has no DB cascade. Block deletion of any account that
        // has been posted to; the user should deactivate it instead.
        if ($account->lines()->exists()) {
            return response()->json([
                'message' => 'Cannot delete: this account is used in journal entries. Deactivate it instead.',
            ], 409);
        }

        if ($blocker = $this->postingUse($account)) {
            return response()->json(['message' => "Cannot delete: this account {$blocker}."], 409);
        }

        $account->delete();

        return response()->json(['message' => 'Deleted.']);
    }

    /** Why an account must stay a postable leaf, or null when nothing depends on it. */
    private function postingUse(Account $account): ?string
    {
        if ($account->lines()->exists()) {
            return 'already has journal postings';
        }
        if (OpeningBalance::where('account_id', $account->id)->exists()) {
            return 'has an opening balance';
        }
        if (in_array($account->id, Posting::roleAccountIds(), true)) {
            return 'is used for auto-posting (Accounting → Posting Setup)';
        }

        return null;
    }

    /**
     * Next free account code for a group: {groupCode}00, +100 each account.
     * e.g. group 1100 -> 110000, 110100, 110200 … skipping any code already
     * taken. Codes are unique across all groups, so we keep stepping until free.
     */
    private function nextAccountCode(AccountGroup $group): string
    {
        $base = (int) $group->code * 100;

        $current = (int) Account::where('group_id', $group->id)
            ->whereNull('parent_id')
            ->max(DB::raw('CAST(code AS UNSIGNED)'));

        $next = $current >= $base ? $current + 100 : $base;

        while (Account::where('code', (string) $next)->exists()) {
            $next += 100;
        }

        return (string) $next;
    }

    /**
     * Next free code for a sub-account, derived from the parent's code by
     * appending a running sequence. e.g. parent 1130 -> 1131, 1132; parent
     * 110100 -> 110101, 110102. Steps until the code is unique chart-wide.
     */
    private function nextChildCode(Account $parent): string
    {
        $base = (int) $parent->code;

        // Highest existing child code (children live just above the parent code).
        $current = (int) Account::where('parent_id', $parent->id)
            ->max(DB::raw('CAST(code AS UNSIGNED)'));

        $next = $current >= $base ? $current + 1 : $base + 1;

        while (Account::where('code', (string) $next)->exists()) {
            $next += 1;
        }

        return (string) $next;
    }
}
