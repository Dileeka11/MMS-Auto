<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    private const MAX_ATTEMPTS = 5;
    private const DECAY_SECONDS = 60;

    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email|max:190',
            'password' => 'required|string|min:6|max:200',
        ]);

        $key = $this->throttleKey($request, $data['email']);

        if (RateLimiter::tooManyAttempts($key, self::MAX_ATTEMPTS)) {
            $seconds = RateLimiter::availableIn($key);

            Log::channel('security')->warning('login_throttled', [
                'email' => $data['email'],
                'ip' => $request->ip(),
                'retry_after' => $seconds,
            ]);

            throw ValidationException::withMessages([
                'email' => ["Too many login attempts. Try again in {$seconds} seconds."],
            ])->status(429);
        }

        $user = User::where('email', $data['email'])->first();

        if (!$user || !Hash::check($data['password'], $user->password)) {
            RateLimiter::hit($key, self::DECAY_SECONDS);

            Log::channel('security')->warning('login_failed', [
                'email' => $data['email'],
                'ip' => $request->ip(),
                'ua' => substr((string) $request->userAgent(), 0, 200),
            ]);

            throw ValidationException::withMessages([
                'email' => ['Invalid email or password.'],
            ]);
        }

        RateLimiter::clear($key);

        $token = $user->createToken('mms-web')->plainTextToken;

        Log::channel('security')->info('login_success', [
            'user_id' => $user->id,
            'email' => $user->email,
            'ip' => $request->ip(),
        ]);

        return [
            'token' => $token,
            'user' => array_merge(
                $user->only(['id', 'name', 'email', 'role', 'branch', 'status']),
                ['permissions' => $user->permissionList()]
            ),
        ];
    }

    public function me(Request $request)
    {
        $u = $request->user();
        return array_merge(
            $u->only(['id', 'name', 'email', 'role', 'branch', 'status']),
            ['permissions' => $u->permissionList()]
        );
    }

    public function logout(Request $request)
    {
        $user = $request->user();
        $user->currentAccessToken()->delete();

        Log::channel('security')->info('logout', [
            'user_id' => $user->id,
            'ip' => $request->ip(),
        ]);

        return ['ok' => true];
    }

    private function throttleKey(Request $request, string $email): string
    {
        return Str::lower($email).'|'.$request->ip();
    }
}
