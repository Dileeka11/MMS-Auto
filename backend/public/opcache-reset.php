<?php
$token = $_GET['token'] ?? '';
if ($token !== 'nms-auto-setup-2026-one-time-xyz9k4j2') {
    http_response_code(403);
    die('Forbidden');
}

ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);

$result = [];

// Action: log — show last 100 lines of Laravel log
if (($_GET['action'] ?? '') === 'log') {
    $logDir = __DIR__ . '/../laravel/storage/logs';
    $files = is_dir($logDir) ? array_diff(scandir($logDir), ['.', '..', '.gitignore']) : [];
    $result['log_dir'] = $logDir;
    $result['log_files'] = array_values($files);
    if (!empty($files)) {
        usort($files, function ($a, $b) use ($logDir) {
            return filemtime($logDir.'/'.$b) <=> filemtime($logDir.'/'.$a);
        });
        $latest = $logDir . '/' . reset($files);
        $result['latest_log'] = basename($latest);
        $content = file_exists($latest) ? file_get_contents($latest) : '';
        $lines = explode("\n", $content);
        $result['last_100_lines'] = array_slice($lines, -100);
    }
    header('Content-Type: application/json');
    echo json_encode($result, JSON_PRETTY_PRINT);
    exit;
}

// Action: test-login — simulate a POST /api/login request internally
if (($_GET['action'] ?? '') === 'test-login') {
    try {
        require __DIR__ . '/../laravel/vendor/autoload.php';
        $app = require __DIR__ . '/../laravel/bootstrap/app.php';
        $kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
        $request = Illuminate\Http\Request::create('/api/login', 'POST', [], [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode(['email' => 'admin@mms-auto.lk', 'password' => 'password']));
        $response = $kernel->handle($request);
        $result['status'] = $response->getStatusCode();
        $result['body'] = $response->getContent();
    } catch (\Throwable $e) {
        $result['error'] = $e->getMessage();
        $result['file'] = $e->getFile() . ':' . $e->getLine();
        $result['trace'] = explode("\n", $e->getTraceAsString());
    }
    header('Content-Type: application/json');
    echo json_encode($result, JSON_PRETTY_PRINT);
    exit;
}

// 1. OPcache reset
$result['opcache_reset'] = function_exists('opcache_reset') ? opcache_reset() : false;
clearstatcache(true);

// 2. Clear Laravel bootstrap caches
$cacheDir = __DIR__ . '/../laravel/bootstrap/cache';
$cleared = [];
foreach (['routes-v7.php', 'routes.php', 'config.php', 'packages.php', 'services.php', 'events.php'] as $f) {
    $path = $cacheDir . '/' . $f;
    if (file_exists($path)) {
        $cleared[] = $f . ' (' . (unlink($path) ? 'deleted' : 'failed') . ')';
    }
}
$result['laravel_cache_cleared'] = $cleared;

// Action: routes — list all registered Laravel routes
if (($_GET['action'] ?? '') === 'routes') {
    try {
        require __DIR__ . '/../laravel/vendor/autoload.php';
        $app = require __DIR__ . '/../laravel/bootstrap/app.php';
        $kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
        $request = Illuminate\Http\Request::create('/test', 'GET');
        $app->instance('request', $request);
        $kernel->bootstrap();
        $routes = [];
        foreach (\Illuminate\Support\Facades\Route::getRoutes() as $route) {
            $routes[] = [
                'methods' => $route->methods(),
                'uri' => $route->uri(),
                'name' => $route->getName(),
                'action' => $route->getActionName(),
            ];
        }
        $result['routes_count'] = count($routes);
        $result['routes'] = $routes;
    } catch (\Throwable $e) {
        $result['error'] = $e->getMessage();
        $result['trace'] = explode("\n", $e->getTraceAsString());
    }
}

// 3. If ?action=migrate, boot Laravel and run migrate + seed
if (($_GET['action'] ?? '') === 'migrate') {
    try {
        require __DIR__ . '/../laravel/vendor/autoload.php';
        $app = require __DIR__ . '/../laravel/bootstrap/app.php';
        $kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
        $kernel->bootstrap();

        $migrateOutput = new Symfony\Component\Console\Output\BufferedOutput();
        $kernel->call('migrate', ['--force' => true], $migrateOutput);
        $result['migrate'] = $migrateOutput->fetch();

        $seedOutput = new Symfony\Component\Console\Output\BufferedOutput();
        $kernel->call('db:seed', ['--force' => true], $seedOutput);
        $result['seed'] = $seedOutput->fetch();
    } catch (\Throwable $e) {
        $result['error'] = $e->getMessage();
        $result['trace'] = $e->getTraceAsString();
    }
}

$result['time'] = date('c');
header('Content-Type: application/json');
echo json_encode($result, JSON_PRETTY_PRINT);
