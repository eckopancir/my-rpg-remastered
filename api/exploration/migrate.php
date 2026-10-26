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

// Флаг трат материалов в путешествии (галочка на старте).
$colsM = $pdo->query("SHOW COLUMNS FROM explorations LIKE 'use_materials'")->fetchAll();
if (!count($colsM)) {
  $pdo->exec("ALTER TABLE explorations ADD COLUMN use_materials TINYINT(1) NOT NULL DEFAULT 1 AFTER was_cancelled");
}

// Рюкзак: взятые в дорогу расходники (сгорают на старте).
$colsC = $pdo->query("SHOW COLUMNS FROM explorations LIKE 'consumables'")->fetchAll();
if (!count($colsC)) {
  $pdo->exec("ALTER TABLE explorations ADD COLUMN consumables JSON DEFAULT NULL AFTER use_materials");
}

// Сложность рейда и модификатор (характер рейда).
$colsDiff = $pdo->query("SHOW COLUMNS FROM explorations LIKE 'difficulty'")->fetchAll();
if (!count($colsDiff)) {
  $pdo->exec("ALTER TABLE explorations ADD COLUMN difficulty VARCHAR(16) NOT NULL DEFAULT 'normal' AFTER planned_sec");
}
$colsMod = $pdo->query("SHOW COLUMNS FROM explorations LIKE 'modifier'")->fetchAll();
if (!count($colsMod)) {
  $pdo->exec("ALTER TABLE explorations ADD COLUMN modifier VARCHAR(16) DEFAULT NULL AFTER difficulty");
}

// Колонка выбора в событии больше не используется (исход выбирается случайно).
$colsPC = $pdo->query("SHOW COLUMNS FROM explorations LIKE 'pending_choice'")->fetchAll();
if (count($colsPC)) {
  $pdo->exec("ALTER TABLE explorations DROP COLUMN pending_choice");
}

// Русское название легендарной цепочки (для UI).
$colsLT = $pdo->query("SHOW COLUMNS FROM exploration_events LIKE 'legendary_title'")->fetchAll();
if (!count($colsLT)) {
  $pdo->exec("ALTER TABLE exploration_events ADD COLUMN legendary_title VARCHAR(64) DEFAULT NULL AFTER legendary_event_id");
}

// Колонка «выброшено»: награда не влезла в рюкзак и была потеряна.
$colsD = $pdo->query("SHOW COLUMNS FROM offline_rewards LIKE 'dropped'")->fetchAll();
if (!count($colsD)) {
  $pdo->exec("ALTER TABLE offline_rewards ADD COLUMN dropped TINYINT(1) NOT NULL DEFAULT 0 AFTER claimed");
}

// Номер арта события (картинки из спрайтов public/art/events, см.
// src/data/eventArt.ts). NULL = событие без картинки (микро/системные).
$colsArt = $pdo->query("SHOW COLUMNS FROM exploration_events LIKE 'art'")->fetchAll();
if (!count($colsArt)) {
  $pdo->exec("ALTER TABLE exploration_events ADD COLUMN art SMALLINT DEFAULT NULL AFTER tick_number");
}

// Расширенная история рейдов: режим, тайминги, причина смерти и потери.
$histCols = [
  'difficulty'   => "ALTER TABLE exploration_history ADD COLUMN difficulty VARCHAR(16) NOT NULL DEFAULT 'normal' AFTER zone",
  'modifier'     => "ALTER TABLE exploration_history ADD COLUMN modifier VARCHAR(16) DEFAULT NULL AFTER difficulty",
  'planned_sec'  => "ALTER TABLE exploration_history ADD COLUMN planned_sec INT NOT NULL DEFAULT 0 AFTER modifier",
  'started_at'   => "ALTER TABLE exploration_history ADD COLUMN started_at DATETIME DEFAULT NULL AFTER duration_seconds",
  'death_cause'  => "ALTER TABLE exploration_history ADD COLUMN death_cause VARCHAR(255) DEFAULT NULL AFTER started_at",
  'lost_chips'   => "ALTER TABLE exploration_history ADD COLUMN lost_chips INT NOT NULL DEFAULT 0 AFTER death_cause",
  'lost_items'   => "ALTER TABLE exploration_history ADD COLUMN lost_items INT NOT NULL DEFAULT 0 AFTER lost_chips",
];
foreach ($histCols as $name => $sql) {
  $c = $pdo->query("SHOW COLUMNS FROM exploration_history LIKE '$name'")->fetchAll();
  if (!count($c)) $pdo->exec($sql);
}

echo json_encode(['ok' => true]);
