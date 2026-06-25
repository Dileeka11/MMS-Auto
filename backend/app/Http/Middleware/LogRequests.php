<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class LogRequests
{
    /**
     * Fields scrubbed before logging.
     */
    private const SENSITIVE = [
        'password', 'password_confirmation', 'current_password',
        'token', 'api_token', 'secret', 'authorization',
        'credit_card', 'card_number', 'cvv', 'pin',
    ];

    private const SLOW_REQUEST_MS = 1500;

    public function handle(Request $request, Closure $next)
    {
        $requestId = (string) Str::uuid();
        $request->attributes->set('request_id', $requestId);

        $start = microtime(true);

        /** @var Response $response */
        $response = $next($request);

        $durationMs = (int) ((microtime(true) - $start) * 1000);

        $response->headers->set('X-Request-Id', $requestId);

        $status = $response->getStatusCode();
        $user = $request->user();

        $context = [
            'request_id' => $requestId,
            'method' => $request->method(),
            'path' => $request->path(),
            'status' => $status,
            'duration_ms' => $durationMs,
            'ip' => $request->ip(),
            'user_id' => $user ? $user->id : null,
            'ua' => substr((string) $request->userAgent(), 0, 200),
        ];

        if ($request->isMethod('GET') === false) {
            $context['payload'] = $this->scrub($request->all());
        }

        $level = $status >= 500 ? 'error' : ($status >= 400 ? 'warning' : 'info');
        Log::channel('requests')->log($level, 'http', $context);

        if ($durationMs >= self::SLOW_REQUEST_MS) {
            Log::channel('performance')->warning('slow_request', $context);
        }

        return $response;
    }

    private function scrub(array $data): array
    {
        foreach ($data as $k => $v) {
            if (is_string($k) && in_array(strtolower($k), self::SENSITIVE, true)) {
                $data[$k] = '***';
            } elseif (is_array($v)) {
                $data[$k] = $this->scrub($v);
            }
        }

        return $data;
    }
}
