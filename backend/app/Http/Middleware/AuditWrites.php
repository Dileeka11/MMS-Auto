<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class AuditWrites
{
    private const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

    public function handle(Request $request, Closure $next)
    {
        /** @var Response $response */
        $response = $next($request);

        if (!in_array($request->method(), self::WRITE_METHODS, true)) {
            return $response;
        }

        // Only audit successful state changes
        $status = $response->getStatusCode();
        if ($status < 200 || $status >= 300) {
            return $response;
        }

        Log::channel('audit')->info('write', [
            'request_id' => $request->attributes->get('request_id'),
            'method' => $request->method(),
            'path' => $request->path(),
            'status' => $status,
            'user_id' => optional($request->user())->id,
            'user_email' => optional($request->user())->email,
            'ip' => $request->ip(),
        ]);

        return $response;
    }
}
