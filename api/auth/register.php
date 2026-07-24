<?php
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

$input = json_decode(file_get_contents('php://input'), true);
$username = trim($input['username'] ?? '');
$password = $input['password'] ?? '';

if (strlen($username) < 3 || strlen($username) > 32) {
    jsonResponse(['error' => 'Логин должен быть от 3 до 32 символов'], 400);
}
if (strlen($password) < 4) {
    jsonResponse(['error' => 'Пароль должен быть минимум 4 символа'], 400);
}
if (!preg_match('/^[a-zA-Z0-9_]+$/', $username)) {
    jsonResponse(['error' => 'Логин может содержать только латинские буквы, цифры и _'], 400);
}

try {
    $pdo = getDB();
    $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ?");
    $stmt->execute([$username]);
    if ($stmt->fetch()) {
        jsonResponse(['error' => 'Пользователь с таким логином уже существует'], 409);
    }

    $hash = password_hash($password, PASSWORD_BCRYPT);
    $stmt = $pdo->prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)");
    $stmt->execute([$username, $hash]);
    $userId = (int)$pdo->lastInsertId();

    $token = generateToken();
    $stmt = $pdo->prepare("INSERT INTO sessions (user_id, token) VALUES (?, ?)");
    $stmt->execute([$userId, $token]);

    jsonResponse([
        'user' => ['id' => $userId, 'username' => $username, 'is_admin' => false],
        'token' => $token,
    ]);
} catch (Exception $e) {
    jsonResponse(['error' => 'Ошибка сервера: ' . $e->getMessage()], 500);
}
