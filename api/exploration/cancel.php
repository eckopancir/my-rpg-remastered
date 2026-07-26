<?php
require_once __DIR__ . '/../../api/config.php';
require_once __DIR__ . '/engine_logic.php';

$pdo = getDB();
$user = requireAuth();
$userId = $user['id'];

$result = cancelExploration($pdo, $userId);
jsonResponse($result);
