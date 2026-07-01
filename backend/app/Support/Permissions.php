<?php

namespace App\Support;

use App\Models\User;
use App\Models\UserPermission;
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
        'Vehicle Brand', 'Vehicle Model', 'Brand Master', 'Brand Category', 'Group Master',
        'Services', 'Department', 'Employee Master', 'Payment Master', 'Bank Master',
        'Country Master', 'Branch Master', 'Expense Type', 'Credit Period', 'Invoice Remark',
        'Purchase Order', 'Costing & Shipment', 'GRN', 'PO Tracking',
        'Quotation', 'Sales Invoice', 'Sales Return', 'Payment Receipt', 'Expense',
        'Stock Transfer', 'Stock Adjustment', 'BIN Card', 'Live Stock', 'Price Control',
        'Reports',
        'Sales Reps', 'User Management', 'User Permission', 'Company Profile',
    ];

    public const ACTIONS = ['View', 'Create', 'Edit', 'Delete', 'Approve'];

    /**
     * Roles shipped with the system. These are now only a convenience: each
     * role has a default permission set that seeds a user's own matrix the
     * first time it is needed. Actual access is resolved per-user. The 'admin'
     * role is implicit — it always has every permission and bypasses the matrix.
     */
    public const ROLES = ['admin', 'manager', 'storekeeper', 'accountant', 'salesrep', 'cashier', 'user'];

    /** Cache TTL (seconds) for a user's resolved permission list. */
    private const CACHE_TTL = 300;

    public static function rolesForUI(): array
    {
        return self::ROLES;
    }

    /**
     * Default permission predicates per role, used only to seed a brand-new
     * user's personal matrix. Returns a map of role => fn(module, action): bool.
     */
    private static function roleDefaults(): array
    {
        return [
            'admin' => fn ($m, $a) => true,
            'manager' => fn ($m, $a) => true && $a !== 'Delete' || in_array($m, ['Sales Invoice', 'Quotation']),
            'storekeeper' => fn ($m, $a) => in_array($m, ['Dashboard', 'Item Master', 'Supplier Master', 'GRN', 'Stock Transfer', 'Stock Adjustment', 'BIN Card', 'Live Stock', 'Price Control']) && $a !== 'Approve',
            'accountant' => fn ($m, $a) => in_array($m, ['Dashboard', 'Customer Master', 'Sales Invoice', 'Payment Receipt', 'Expense', 'Reports']) && $a !== 'Delete',
            'salesrep' => fn ($m, $a) => in_array($m, ['Dashboard', 'Item Master', 'Customer Master', 'Quotation', 'Sales Invoice']) && in_array($a, ['View', 'Create']),
            'cashier' => fn ($m, $a) => in_array($m, ['Dashboard', 'Payment Receipt', 'Sales Invoice']) && in_array($a, ['View', 'Create']),
            'user' => fn ($m, $a) => $m === 'Dashboard' && $a === 'View',
        ];
    }

    /** Empty {module: {action: false}} grid. */
    private static function emptyGrid(): array
    {
        $grid = [];
        foreach (self::MODULES as $m) {
            foreach (self::ACTIONS as $a) {
                $grid[$m][$a] = false;
            }
        }

        return $grid;
    }

    /** Default {module: {action: bool}} grid for a role. */
    public static function defaultGridForRole(string $role): array
    {
        $fn = self::roleDefaults()[$role] ?? self::roleDefaults()['user'];
        $grid = [];
        foreach (self::MODULES as $m) {
            foreach (self::ACTIONS as $a) {
                $grid[$m][$a] = (bool) $fn($m, $a);
            }
        }

        return $grid;
    }

    /**
     * Ensure a user has a personal permission matrix. On first use we seed it
     * from the user's role defaults so admins have a sensible starting point.
     * Admin users are never seeded — their access is implicit.
     */
    public static function seedUserIfMissing(User $user): void
    {
        if ($user->role === 'admin') {
            return;
        }
        if (UserPermission::where('user_id', $user->id)->exists()) {
            return;
        }
        $grid = self::defaultGridForRole($user->role ?: 'user');
        $rows = [];
        foreach ($grid as $module => $actions) {
            foreach ($actions as $action => $enabled) {
                if ($enabled) {
                    $rows[] = [
                        'user_id' => $user->id, 'module' => $module, 'action' => $action,
                        'created_at' => now(), 'updated_at' => now(),
                    ];
                }
            }
        }
        if ($rows) {
            UserPermission::insert($rows);
        }
        Cache::forget("perm:user:{$user->id}");
    }

    /**
     * Return a {module: {action: bool}} matrix for a single user.
     * Admin users get every permission.
     */
    public static function gridForUser(User $user): array
    {
        $grid = self::emptyGrid();
        if ($user->role === 'admin') {
            foreach (self::MODULES as $m) {
                foreach (self::ACTIONS as $a) {
                    $grid[$m][$a] = true;
                }
            }

            return $grid;
        }
        foreach (UserPermission::where('user_id', $user->id)->get() as $p) {
            if (isset($grid[$p->module][$p->action])) {
                $grid[$p->module][$p->action] = true;
            }
        }

        return $grid;
    }

    /**
     * Replace all permissions for a user with the given matrix slice:
     *   {module: {action: bool}}
     */
    public static function saveForUser(User $user, array $modules): void
    {
        if ($user->role === 'admin') {
            return; // admin permissions are implicit and not stored.
        }
        UserPermission::where('user_id', $user->id)->delete();
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
                        'user_id' => $user->id, 'module' => $module, 'action' => $action,
                        'created_at' => now(), 'updated_at' => now(),
                    ];
                }
            }
        }
        if ($rows) {
            UserPermission::insert($rows);
        }
        Cache::forget("perm:user:{$user->id}");
    }

    /**
     * Flat list of "Module:Action" strings the user has access to.
     */
    public static function forUser(?User $user): array
    {
        if (!$user) {
            return [];
        }
        if ($user->role === 'admin') {
            $all = [];
            foreach (self::MODULES as $m) {
                foreach (self::ACTIONS as $a) {
                    $all[] = "{$m}:{$a}";
                }
            }

            return $all;
        }

        return Cache::remember("perm:user:{$user->id}", self::CACHE_TTL, function () use ($user) {
            return UserPermission::where('user_id', $user->id)
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

        return in_array("{$module}:{$action}", self::forUser($user), true);
    }
}
