<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Blocks staff accounts that were set to Inactive after they logged in.
 * Their current token is revoked so the browser is sent back to login.
 */
class EnsureActiveUser
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();
        if ($user && ($user->status ?? 'Active') === 'Inactive') {
            $token = $user->currentAccessToken();
            if ($token && method_exists($token, 'delete')) {
                $token->delete();
            }
            Log::channel('security')->warning('inactive_user_blocked', [
                'user_id' => $user->id,
                'ip' => $request->ip(),
            ]);

            return response()->json(['message' => 'Your account is inactive.'], 401);
        }

        return $next($request);
    }
}
