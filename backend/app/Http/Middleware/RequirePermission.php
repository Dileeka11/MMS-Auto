<?php

namespace App\Http\Middleware;

use App\Support\Permissions;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Server-side enforcement of the per-user permission matrix (the same
 * "Module:Action" list the React app uses to hide screens and buttons).
 *
 * Usage:  ->middleware('perm:Item Master')               action from HTTP verb
 *         ->middleware('perm:Item Master|Price Control')  any of these modules
 *         ->middleware('perm:Sales Return,Approve')       explicit action
 *         ->middleware('perm:@master')                    module from {type} of masters/{type}
 *
 * Reads (GET/HEAD) pass unless an explicit action is given: every screen loads
 * lookups (items, customers, branches…) from other modules for its dropdowns.
 * Writes map POST→Create, PUT/PATCH→Edit, DELETE→Delete. Admin bypasses.
 */
class RequirePermission
{
    /** masters/{type} route keys → permission module. */
    public const MASTER_MODULES = [
        'vehicleBrand' => 'Vehicle Brand',
        'vehicleModel' => 'Vehicle Model',
        'brand' => 'Brand Master',
        'brandCat' => 'Brand Category',
        'group' => 'Group Master',
        'services' => 'Services',
        'department' => 'Department',
        'employee' => 'Employee Master',
        'payment' => 'Payment Master',
        'bank' => 'Bank Master',
        'country' => 'Country Master',
        'branch' => 'Branch Master',
        'expenseType' => 'Expense Type',
        'credit' => 'Credit Period',
        'remark' => 'Invoice Remark',
        'salesExec' => 'Sales Executive',
    ];

    private const VERB_ACTION = [
        'POST' => 'Create',
        'PUT' => 'Edit',
        'PATCH' => 'Edit',
        'DELETE' => 'Delete',
    ];

    public function handle(Request $request, Closure $next, string $modules, ?string $action = null)
    {
        $user = $request->user();
        if ($user && $user->role === 'admin') {
            return $next($request);
        }

        if ($modules === '@master') {
            $type = (string) $request->route('type');
            if (!isset(self::MASTER_MODULES[$type])) {
                return response()->json(['message' => 'Unknown master file.'], 404);
            }
            $modules = self::MASTER_MODULES[$type];
        }

        if ($action === null) {
            $action = self::VERB_ACTION[strtoupper($request->method())] ?? null;
            if ($action === null) {
                return $next($request); // read-only request
            }
        }

        foreach (explode('|', $modules) as $module) {
            if (Permissions::userCan($user, trim($module), $action)) {
                return $next($request);
            }
        }

        Log::channel('security')->warning('permission_denied', [
            'user_id' => $user ? $user->id : null,
            'need' => $modules . ':' . $action,
            'method' => $request->method(),
            'path' => $request->path(),
            'ip' => $request->ip(),
        ]);

        return response()->json([
            'message' => "You don't have permission to {$this->verb($action)} in " . str_replace('|', ' / ', $modules) . '.',
        ], 403);
    }

    private function verb(string $action): string
    {
        $map = ['Create' => 'create records', 'Edit' => 'edit records', 'Delete' => 'delete records', 'Approve' => 'approve', 'View' => 'view this'];

        return $map[$action] ?? strtolower($action);
    }
}
