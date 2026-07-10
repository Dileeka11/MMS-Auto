<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SalesRep;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class RepAuthController extends Controller
{
    private const MAX_ATTEMPTS = 5;
    private const DECAY_SECONDS = 60;

    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email|max:190',
            'password' => 'required|string|min:6|max:200',
        ]);

        $key = Str::lower($data['email']) . '|rep|' . $request->ip();

        if (RateLimiter::tooManyAttempts($key, self::MAX_ATTEMPTS)) {
            $seconds = RateLimiter::availableIn($key);
            throw ValidationException::withMessages([
                'email' => ["Too many login attempts. Try again in {$seconds} seconds."],
            ])->status(429);
        }

        $rep = SalesRep::where('email', $data['email'])->first();

        if (! $rep || ! $rep->password || ! Hash::check($data['password'], $rep->password)) {
            RateLimiter::hit($key, self::DECAY_SECONDS);
            Log::channel('security')->warning('rep_login_failed', [
                'email' => $data['email'],
                'ip' => $request->ip(),
            ]);
            throw ValidationException::withMessages([
                'email' => ['Invalid email or password.'],
            ]);
        }

        if (! $rep->app_enabled) {
            throw ValidationException::withMessages([
                'email' => ['This account is disabled. Contact your administrator.'],
            ]);
        }

        RateLimiter::clear($key);

        $token = $rep->createToken('rep-app')->plainTextToken;

        Log::channel('security')->info('rep_login_success', [
            'rep_id' => $rep->id,
            'email' => $rep->email,
            'ip' => $request->ip(),
        ]);

        return [
            'token' => $token,
            'rep' => $this->repPayload($rep),
        ];
    }

    public function me(Request $request)
    {
        return $this->repPayload($request->user());
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return ['ok' => true];
    }

    private function repPayload(SalesRep $rep): array
    {
        return $rep->only([
            'id', 'code', 'name', 'email', 'zone', 'phone', 'branch',
            'target', 'achieved', 'visits', 'invoices', 'avatar', 'app_enabled',
        ]);
    }
}
