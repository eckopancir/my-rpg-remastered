<?php
require_once __DIR__ . '/../../api/config.php';
$pdo = getDB();

$cols1 = $pdo->query("SHOW COLUMNS FROM exploration_events LIKE 'legendary_result'")->fetchAll();
if (!count($cols1)) {
  $pdo->exec("ALTER TABLE exploration_events ADD COLUMN legendary_result VARCHAR(20) DEFAULT NULL AFTER legendary_stage");
}

$cols2 = $pdo->query("SHOW COLUMNS FROM explorations LIKE 'total_items'")->fetchAll();
if (!count($cols2)) {
  $pdo->exec("ALTER TABLE explorations ADD COLUMN total_items INT NOT NULL DEFAULT 0 AFTER total_exp");
}

echo json_encode(['ok' => true]);
