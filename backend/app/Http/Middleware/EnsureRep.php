<?php

namespace App\Http\Middleware;

use App\Models\SalesRep;
use Closure;
use Illuminate\Http\Request;

class EnsureRep
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();
        if (! $user instanceof SalesRep) {
            return response()->json(['message' => 'Sales rep account required.'], 403);
        }

        return $next($request);
    }
}
