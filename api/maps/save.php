<?php
require_once __DIR__ . '/../config.php';

$user = requireAuth();
$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['name']) || !isset($input['map'])) {
    jsonResponse(['error' => 'Missing name/map'], 400);
}
$name = trim((string)$input['name']);
if ($name === '' || mb_strlen($name) > 128) {
    jsonResponse(['error' => 'Bad name'], 400);
}
$map = $input['map'];
if (!is_array($map) || !isset($map['obstacles']) || !is_array($map['obstacles']) || !isset($map['units']) || !is_array($map['units'])) {
    jsonResponse(['error' => 'Bad map'], 400);
}
$mapJson = json_encode($map, JSON_UNESCAPED_UNICODE);
if ($mapJson === false || strlen($mapJson) > 2000000) {
    jsonResponse(['error' => 'Map too big'], 400);
}

$pdo = getDB();
$stmt = $pdo->prepare(
    'INSERT INTO custom_maps (user_id, name, map_data, updated_at) VALUES (?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE map_data = VALUES(map_data), updated_at = NOW()'
);
$stmt->execute([$user['id'], $name, $mapJson]);

jsonResponse(['ok' => true, 'name' => $name]);
