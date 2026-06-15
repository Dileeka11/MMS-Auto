<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $data['email'])->first();
        if (!$user || !Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Invalid email or password.'],
            ]);
        }

        $token = $user->createToken('mms-web')->plainTextToken;

        return [
            'token' => $token,
            'user' => $user->only(['id', 'name', 'email']),
        ];
    }

    public function me(Request $request)
    {
        return $request->user()->only(['id', 'name', 'email']);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return ['ok' => true];
    }
}
