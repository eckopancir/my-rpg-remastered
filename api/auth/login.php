<?php
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

$input = json_decode(file_get_contents('php://input'), true);
$username = trim($input['username'] ?? '');
$password = $input['password'] ?? '';

if (empty($username) || empty($password)) {
    jsonResponse(['error' => 'Введите логин и пароль'], 400);
}

try {
    $pdo = getDB();
    $stmt = $pdo->prepare("SELECT id, username, password_hash, is_admin FROM users WHERE username = ?");
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        jsonResponse(['error' => 'Неверный логин или пароль'], 401);
    }

    $token = generateToken();
    $stmt = $pdo->prepare("INSERT INTO sessions (user_id, token) VALUES (?, ?)");
    $stmt->execute([$user['id'], $token]);

    jsonResponse([
        'user' => [
            'id' => (int)$user['id'],
            'username' => $user['username'],
            'is_admin' => (bool)$user['is_admin'],
        ],
        'token' => $token,
    ]);
} catch (Exception $e) {
    jsonResponse(['error' => 'Ошибка сервера: ' . $e->getMessage()], 500);
}
