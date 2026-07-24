<?php
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

$user = getSessionUser();
if (!$user) {
    jsonResponse(['error' => 'Not authenticated'], 401);
}

jsonResponse([
    'user' => [
        'id' => (int)$user['id'],
        'username' => $user['username'],
        'is_admin' => (bool)$user['is_admin'],
    ],
]);
