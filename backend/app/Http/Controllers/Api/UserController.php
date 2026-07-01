<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\Permissions;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index()
    {
        return User::orderBy('id')->get(['id', 'name', 'email', 'role', 'branch', 'status', 'created_at']);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'     => 'required|string|max:255',
            'email'    => 'required|email|unique:users,email',
            'password' => 'required|string|min:6',
            'role'     => ['required', 'string', Rule::in(Permissions::ROLES)],
            'branch'   => 'nullable|string|max:64',
            'status'   => ['nullable', Rule::in(['Active', 'Inactive'])],
        ]);
        $user = User::create([
            'name'     => $data['name'],
            'email'    => $data['email'],
            'password' => Hash::make($data['password']),
            'role'     => $data['role'],
            'branch'   => $data['branch'] ?? null,
            'status'   => $data['status'] ?? 'Active',
        ]);

        // Seed the new user's personal permission matrix from their role defaults.
        Permissions::seedUserIfMissing($user);

        return response()->json($user->only(['id', 'name', 'email', 'role', 'branch', 'status', 'created_at']), 201);
    }

    public function update(Request $request, User $user)
    {
        $data = $request->validate([
            'name'     => 'sometimes|string|max:255',
            'email'    => ['sometimes', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => 'nullable|string|min:6',
            'role'     => ['sometimes', 'string', Rule::in(Permissions::ROLES)],
            'branch'   => 'nullable|string|max:64',
            'status'   => ['nullable', Rule::in(['Active', 'Inactive'])],
        ]);
        if (isset($data['name']))   $user->name = $data['name'];
        if (isset($data['email']))  $user->email = $data['email'];
        if (isset($data['role']))   $user->role = $data['role'];
        if (array_key_exists('branch', $data)) $user->branch = $data['branch'];
        if (array_key_exists('status', $data)) $user->status = $data['status'] ?? $user->status;
        if (!empty($data['password'])) $user->password = Hash::make($data['password']);
        $user->save();

        return $user->only(['id', 'name', 'email', 'role', 'branch', 'status', 'created_at']);
    }

    public function destroy(Request $request, User $user)
    {
        if ($request->user()->id === $user->id) {
            return response()->json(['message' => 'You cannot delete your own account.'], 422);
        }
        $user->delete();

        return response()->noContent();
    }
}
