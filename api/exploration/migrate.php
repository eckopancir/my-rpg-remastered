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

// Композитный индекс для пагинации лога (ORDER BY id DESC + прунинг).
// Убирает filesort по тысячам строк после долгого офлайна.
$idx = $pdo->query("SHOW INDEX FROM exploration_events WHERE Key_name = 'idx_exp_id'")->fetchAll();
if (!count($idx)) {
  $pdo->exec("ALTER TABLE exploration_events ADD INDEX idx_exp_id (exploration_id, id)");
}

// Таблица оффлайн-наград (пишет engine_logic, читает get_pending_rewards.php).
// Её не было в schema.sql — создаём здесь, чтобы существующие базы доехали.
$pdo->exec("CREATE TABLE IF NOT EXISTS offline_rewards (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    exploration_id INT UNSIGNED NOT NULL,
    event_id INT UNSIGNED NOT NULL DEFAULT 0,
    event_text TEXT DEFAULT NULL,
    item_count INT NOT NULL DEFAULT 0,
    player_level INT NOT NULL DEFAULT 1,
    generation_version INT NOT NULL DEFAULT 1,
    reward_data JSON DEFAULT NULL,
    claimed TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    claimed_at DATETIME DEFAULT NULL,
    INDEX idx_user_claimed (user_id, claimed),
    CONSTRAINT fk_offline_rw_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// Плановая длительность экспедиции (слайдер 2-24ч) и флаг досрочного возврата.
$colsP = $pdo->query("SHOW COLUMNS FROM explorations LIKE 'planned_sec'")->fetchAll();
if (!count($colsP)) {
  $pdo->exec("ALTER TABLE explorations ADD COLUMN planned_sec INT NOT NULL DEFAULT 0 AFTER time_left");
}
$colsW = $pdo->query("SHOW COLUMNS FROM explorations LIKE 'was_cancelled'")->fetchAll();
if (!count($colsW)) {
  $pdo->exec("ALTER TABLE explorations ADD COLUMN was_cancelled TINYINT(1) NOT NULL DEFAULT 0 AFTER planned_sec");
}

echo json_encode(['ok' => true]);
