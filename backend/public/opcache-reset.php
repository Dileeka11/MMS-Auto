<?php
$token = $_GET['token'] ?? '';
if ($token !== 'nms-auto-setup-2026-one-time-xyz9k4j2') {
    http_response_code(403);
    die('Forbidden');
}

$reset = function_exists('opcache_reset') ? opcache_reset() : false;
clearstatcache(true);

// Clear Laravel bootstrap caches so new routes/config are picked up
$cacheDir = __DIR__ . '/../laravel/bootstrap/cache';
$cleared = [];
foreach (['routes-v7.php', 'routes.php', 'config.php', 'packages.php', 'services.php', 'events.php'] as $f) {
    $path = $cacheDir . '/' . $f;
    if (file_exists($path)) {
        $cleared[] = $f . ' (' . (unlink($path) ? 'deleted' : 'failed') . ')';
    }
}

echo json_encode([
    'opcache_reset' => $reset,
    'laravel_cache_cleared' => $cleared,
    'time' => date('c'),
]);
