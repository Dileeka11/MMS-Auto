<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Permissions;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class PermissionController extends Controller
{
    public function index()
    {
        Permissions::seedDefaultsIfEmpty();

        return [
            'roles'   => Permissions::ROLES,
            'modules' => Permissions::MODULES,
            'actions' => Permissions::ACTIONS,
            'matrix'  => Permissions::matrix(),
        ];
    }

    /**
     * Replace permissions for a single role.
     * Body: { modules: { "Module Name": { "View": true, ... } } }
     */
    public function updateRole(Request $request, string $role)
    {
        if (!in_array($role, Permissions::ROLES, true)) {
            return response()->json(['message' => 'Unknown role.'], 422);
        }
        $data = $request->validate([
            'modules' => 'required|array',
        ]);
        Permissions::saveForRole($role, $data['modules']);

        Log::channel('audit')->info('permissions_updated', [
            'role' => $role,
            'by' => $request->user()?->id,
        ]);

        return ['ok' => true, 'matrix' => Permissions::matrix()];
    }
}
