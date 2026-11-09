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
 * generated (never user-editable) in the NMS cost-code format: a letter for
 * the side of the books (R income, E expense, A asset, L liability/equity) and
 * a number — R1000 header, R1100 / R1200 under it. An account that has children
 * is a "header" and is not postable — only leaf accounts may be used in journal
 * entries. System (cost-code) accounts can be edited but not deleted.
 */
class AccountController extends Controller
{
    /** Flat chart list, each row joined up to group + category + statement type. */
    public function index()
    {
        // account id => the auto-posting roles that use it (the Cash Book's supplier payment needs "payable").
        $roles = [];
        foreach (Posting::roleAccountIds() as $key => $id) {
            if ($id) {
                $roles[$id][] = $key;
            }
        }

        return Account::query()
            ->join('account_groups as g', 'g.id', '=', 'accounts.group_id')
            ->join('account_categories as c', 'c.id', '=', 'g.category_id')
            ->orderBy('accounts.code')
            ->get([
                'accounts.id',
                'accounts.code',
                'accounts.name',
                'accounts.description',
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
            ->map(function ($r) use ($roles) {
                $r->is_active = (bool) $r->is_active;
                $r->is_default = (bool) $r->is_default;
                $r->is_cashbook = (bool) $r->is_cashbook;
                $r->has_children = (bool) $r->has_children;
                $r->is_postable = ! $r->has_children; // only leaves can be posted to
                $r->posting_roles = $roles[$r->id] ?? [];
                return $r;
            });
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'group_id' => ['nullable', 'integer', 'exists:account_groups,id'],
            'parent_id' => ['nullable', 'integer', 'exists:accounts,id'],
            'name' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:255'],
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
            'description' => $data['description'] ?? null,
            'is_active' => $data['is_active'] ?? true,
            'is_default' => false,
            'is_cashbook' => (bool) ($data['is_cashbook'] ?? false),
            'created_by' => 'admin',
        ]);

        return response()->json($account, 201);
    }

    /**
     * Only the name, description and flags are editable. Codes are system-generated and
     * locked; group/parent moves are out of scope so the tree stays consistent.
     */
    public function update(Request $request, Account $account)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:255'],
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
            'description' => array_key_exists('description', $data) ? $data['description'] : $account->description,
            'is_active' => $active,
            'is_cashbook' => $cashbook,
        ]);

        return response()->json($account);
    }

    public function destroy(Account $account)
    {
        if ($account->is_default) {
            return response()->json([
                'message' => 'Cannot delete: this is a system cost-code account. Deactivate it instead.',
            ], 409);
        }

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
     * Cost-code letter for a group, read from the DB: the letter its own code
     * starts with (A31 -> A, R1 -> R), else the letter its accounts use.
     */
    private function prefixFor(AccountGroup $group): string
    {
        if (preg_match('/^([A-Za-z]+)/', (string) $group->code, $m)) {
            return $m[1];
        }
        $code = Account::where('group_id', $group->id)->orderBy('code')->value('code');

        return $code ? $this->split($code)[0] : '';
    }

    /**
     * Next free top-level code in a group: one step past the group's highest
     * top-level code — a thousand after a round thousand (E8000 -> E9000),
     * else a hundred (A3600 -> A3700). Skips codes taken anywhere in the chart.
     */
    private function nextAccountCode(AccountGroup $group): string
    {
        $prefix = $this->prefixFor($group);

        $top = $this->numbers(Account::where('group_id', $group->id)->whereNull('parent_id')->pluck('code'), $prefix);
        if ($top) {
            $max = max($top);
            $next = $max + ($max % 1000 === 0 ? 1000 : 100);
        } else {
            // Empty group: the next free thousand after everything on this side.
            $all = $this->numbers(Account::pluck('code'), $prefix);
            $next = $all ? (intdiv(max($all), 1000) + 1) * 1000 : 1000;
        }

        return $this->free($prefix, $next, 100);
    }

    /**
     * Next free sub-account code, in the parent's numbering: the step follows
     * the last sibling (R1400 -> R1500, E4520 -> E4530, A3544 -> A3545); a
     * first child steps one level below the parent (R1000 -> R1100,
     * A3500 -> A3510, A3120 -> A3121).
     */
    private function nextChildCode(Account $parent): string
    {
        [$prefix, $base] = $this->split($parent->code);

        $siblings = $this->numbers(Account::where('parent_id', $parent->id)->pluck('code'), $prefix);
        if ($siblings) {
            $last = max($siblings);
            $step = $last % 100 === 0 ? 100 : ($last % 10 === 0 ? 10 : 1);
            $next = $last + $step;
        } else {
            $step = $base % 1000 === 0 ? 100 : ($base % 100 === 0 ? 10 : 1);
            $next = $base + $step;
        }

        return $this->free($prefix, $next, $step);
    }

    /** "R1100" -> ["R", 1100]; a legacy "110100" -> ["", 110100]. */
    private function split(string $code): array
    {
        return preg_match('/^([A-Za-z]*)(\d+)$/', $code, $m) ? [$m[1], (int) $m[2]] : ['', 0];
    }

    /** The numeric parts of the codes that carry $prefix. */
    private function numbers($codes, string $prefix): array
    {
        $out = [];
        foreach ($codes as $code) {
            [$p, $n] = $this->split((string) $code);
            if ($p === $prefix && $n > 0) {
                $out[] = $n;
            }
        }

        return $out;
    }

    /** First code from $next (stepping by $step) not already used anywhere in the chart. */
    private function free(string $prefix, int $next, int $step): string
    {
        $taken = array_flip(Account::pluck('code')->all());
        while (isset($taken[$prefix . $next])) {
            $next += $step;
        }

        return $prefix . $next;
    }
}
