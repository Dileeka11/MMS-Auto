<?php
$token = $_GET['token'] ?? '';
if ($token !== 'nms-auto-setup-2026-one-time-xyz9k4j2') {
    http_response_code(403);
    die('Forbidden');
}
$reset = function_exists('opcache_reset') ? opcache_reset() : false;
clearstatcache(true);
echo json_encode([
    'opcache_reset' => $reset,
    'time' => date('c'),
]);
