<?php

namespace App\Support;

use App\Models\RolePermission;
use App\Models\User;
use Illuminate\Support\Facades\Cache;

class Permissions
{
    /**
     * Canonical list of modules and actions the system exposes.
     * Add new entries here when new screens / capabilities ship.
     */
    public const MODULES = [
        'Dashboard',
        'Item Master', 'Customer Master', 'Supplier Master', 'Sales Executive',
        'Purchase Order', 'Costing & Shipment', 'GRN', 'PO Tracking',
        'Quotation', 'Sales Invoice', 'Sales Return', 'Payment Receipt', 'Expense',
        'Stock Transfer', 'Stock Adjustment', 'BIN Card', 'Live Stock', 'Price Control',
        'Reports',
        'Sales Reps', 'User Management', 'User Permission', 'Company Profile',
    ];

    public const ACTIONS = ['View', 'Create', 'Edit', 'Delete', 'Approve'];

    /**
     * Default roles shipped with the system. The 'admin' role is implicit:
     * it always has every permission and bypasses the matrix.
     */
    public const ROLES = ['admin', 'manager', 'storekeeper', 'accountant', 'salesrep', 'cashier', 'user'];

    /** Cache TTL (seconds) for the per-role matrix. */
    private const CACHE_TTL = 300;

    public static function rolesForUI(): array
    {
        return self::ROLES;
    }

    /**
     * Return a {role: {module: {action: bool}}} matrix for every role.
     */
    public static function matrix(): array
    {
        $rows = RolePermission::all();
        $out = [];
        foreach (self::ROLES as $r) {
            $out[$r] = [];
            foreach (self::MODULES as $m) {
                $out[$r][$m] = [];
                foreach (self::ACTIONS as $a) {
                    $out[$r][$m][$a] = $r === 'admin'; // admin defaults to all
                }
            }
        }
        foreach ($rows as $p) {
            if (isset($out[$p->role][$p->module][$p->action])) {
                $out[$p->role][$p->module][$p->action] = true;
            }
        }

        return $out;
    }

    /**
     * Replace all permissions for a role with the given matrix slice:
     *   {module: {action: bool}}
     */
    public static function saveForRole(string $role, array $modules): void
    {
        if ($role === 'admin') {
            return; // admin permissions are implicit and not stored.
        }
        RolePermission::where('role', $role)->delete();
        $rows = [];
        foreach ($modules as $module => $actions) {
            if (!in_array($module, self::MODULES, true)) {
                continue;
            }
            foreach ($actions as $action => $enabled) {
                if (!in_array($action, self::ACTIONS, true)) {
                    continue;
                }
                if ($enabled) {
                    $rows[] = [
                        'role' => $role, 'module' => $module, 'action' => $action,
                        'created_at' => now(), 'updated_at' => now(),
                    ];
                }
            }
        }
        if ($rows) {
            RolePermission::insert($rows);
        }
        Cache::forget("perm:role:{$role}");
    }

    /**
     * Flat list of "Module:Action" strings the role has access to.
     */
    public static function forRole(string $role): array
    {
        if ($role === 'admin') {
            $all = [];
            foreach (self::MODULES as $m) {
                foreach (self::ACTIONS as $a) {
                    $all[] = "{$m}:{$a}";
                }
            }
            return $all;
        }
        return Cache::remember("perm:role:{$role}", self::CACHE_TTL, function () use ($role) {
            return RolePermission::where('role', $role)
                ->get()
                ->map(fn ($p) => "{$p->module}:{$p->action}")
                ->values()
                ->all();
        });
    }

    public static function userCan(?User $user, string $module, string $action): bool
    {
        if (!$user) {
            return false;
        }
        if ($user->role === 'admin') {
            return true;
        }
        return in_array("{$module}:{$action}", self::forRole($user->role), true);
    }

    /**
     * Seed a sensible default matrix the first time the table is empty.
     */
    public static function seedDefaultsIfEmpty(): void
    {
        if (RolePermission::count() > 0) {
            return;
        }
        $defaults = [
            'manager' => fn ($m, $a) => true && $a !== 'Delete' || in_array($m, ['Sales Invoice', 'Quotation']),
            'storekeeper' => fn ($m, $a) => in_array($m, ['Dashboard', 'Item Master', 'Supplier Master', 'GRN', 'Stock Transfer', 'Stock Adjustment', 'BIN Card', 'Live Stock', 'Price Control']) && $a !== 'Approve',
            'accountant' => fn ($m, $a) => in_array($m, ['Dashboard', 'Customer Master', 'Sales Invoice', 'Payment Receipt', 'Expense', 'Reports']) && $a !== 'Delete',
            'salesrep' => fn ($m, $a) => in_array($m, ['Dashboard', 'Item Master', 'Customer Master', 'Quotation', 'Sales Invoice']) && in_array($a, ['View', 'Create']),
            'cashier' => fn ($m, $a) => in_array($m, ['Dashboard', 'Payment Receipt', 'Sales Invoice']) && in_array($a, ['View', 'Create']),
            'user' => fn ($m, $a) => $m === 'Dashboard' && $a === 'View',
        ];
        $rows = [];
        foreach ($defaults as $role => $fn) {
            foreach (self::MODULES as $m) {
                foreach (self::ACTIONS as $a) {
                    if ($fn($m, $a)) {
                        $rows[] = ['role' => $role, 'module' => $m, 'action' => $a, 'created_at' => now(), 'updated_at' => now()];
                    }
                }
            }
        }
        if ($rows) {
            RolePermission::insert($rows);
        }
    }
}
