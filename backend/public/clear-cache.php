<?php
/**
 * One-time cache clearer for hosts without shell/SSH access.
 *
 * Usage:  https://your-site/clear-cache.php?token=nms-auto-setup-2026-one-time-xyz9k4j2
 * DELETE THIS FILE right after you've used it.
 */

if (($_GET['token'] ?? '') !== 'nms-auto-setup-2026-one-time-xyz9k4j2') {
    http_response_code(403);
    exit('Forbidden');
}

require __DIR__ . '/../vendor/autoload.php';

$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);

$out = [];
foreach (['route:clear', 'config:clear', 'cache:clear', 'view:clear'] as $cmd) {
    try {
        $kernel->call($cmd);
        $out[$cmd] = trim($kernel->output()) ?: 'ok';
    } catch (\Throwable $e) {
        $out[$cmd] = 'ERROR: ' . $e->getMessage();
    }
}

header('Content-Type: application/json');
echo json_encode($out, JSON_PRETTY_PRINT);
