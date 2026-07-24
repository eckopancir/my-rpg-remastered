<?php
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

$headers = getallheaders();
$token = $headers['Authorization'] ?? $headers['authorization'] ?? '';
$token = str_replace('Bearer ', '', $token);

if (!empty($token)) {
    try {
        $pdo = getDB();
        $stmt = $pdo->prepare("DELETE FROM sessions WHERE token = ?");
        $stmt->execute([$token]);
    } catch (Exception $e) {
        // ignore
    }
}

jsonResponse(['message' => 'Вы вышли из системы']);
