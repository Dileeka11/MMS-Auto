<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\Permissions;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class PermissionController extends Controller
{
    public function index()
    {
        $users = User::orderBy('id')->get(['id', 'name', 'email', 'role']);

        $matrix = [];
        foreach ($users as $user) {
            Permissions::seedUserIfMissing($user);
            $matrix[$user->id] = Permissions::gridForUser($user);
        }

        return [
            'users'   => $users,
            'modules' => Permissions::MODULES,
            'actions' => Permissions::ACTIONS,
            'matrix'  => $matrix,
        ];
    }

    /**
     * Replace permissions for a single user.
     * Body: { modules: { "Module Name": { "View": true, ... } } }
     */
    public function updateUser(Request $request, User $user)
    {
        $data = $request->validate([
            'modules' => 'required|array',
        ]);
        Permissions::saveForUser($user, $data['modules']);

        Log::channel('audit')->info('permissions_updated', [
            'user_id' => $user->id,
            'by' => optional($request->user())->id,
        ]);

        return ['ok' => true, 'matrix' => Permissions::gridForUser($user)];
    }
}
