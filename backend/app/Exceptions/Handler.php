<?php

namespace App\Exceptions;

use Illuminate\Auth\AuthenticationException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Throwable;

class Handler extends ExceptionHandler
{
    protected $dontReport = [
        ValidationException::class,
        AuthenticationException::class,
        AuthorizationException::class,
    ];

    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
        'token',
        'api_token',
        'secret',
    ];

    public function register()
    {
        $this->reportable(function (Throwable $e) {
            // Route reportable exceptions to the dedicated 'errors' channel
            Log::channel('errors')->error($e->getMessage(), [
                'exception' => get_class($e),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => collect($e->getTrace())->take(15)->all(),
            ]);
        });

        $this->renderable(function (Throwable $e, $request) {
            if (!$request->is('api/*') && !$request->expectsJson()) {
                return null;
            }

            return $this->jsonError($e);
        });
    }

    protected function unauthenticated($request, AuthenticationException $exception)
    {
        if ($request->is('api/*') || $request->expectsJson()) {
            Log::channel('security')->info('unauthenticated', [
                'path' => $request->path(),
                'ip' => $request->ip(),
            ]);

            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        return redirect()->guest(route('login'));
    }

    private function jsonError(Throwable $e): JsonResponse
    {
        if ($e instanceof ValidationException) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => $e->errors(),
            ], 422);
        }

        if ($e instanceof ModelNotFoundException || $e instanceof NotFoundHttpException) {
            return response()->json(['message' => 'Resource not found.'], 404);
        }

        if ($e instanceof AuthorizationException) {
            return response()->json(['message' => 'This action is unauthorized.'], 403);
        }

        if ($e instanceof HttpExceptionInterface) {
            return response()->json([
                'message' => $e->getMessage() ?: 'Request failed.',
            ], $e->getStatusCode());
        }

        $debug = config('app.debug');

        return response()->json([
            'message' => $debug ? $e->getMessage() : 'Server error.',
            'exception' => $debug ? get_class($e) : null,
            'file' => $debug ? $e->getFile().':'.$e->getLine() : null,
        ], 500);
    }
}
