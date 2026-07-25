CREATE DATABASE IF NOT EXISTS rpg CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE rpg;

CREATE TABLE users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_admin TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE sessions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    token VARCHAR(128) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_token (token),
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE saves (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    save_data LONGTEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY user_id (user_id),
    CONSTRAINT fk_saves_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE timers (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    duration INT NOT NULL DEFAULT 0,
    tick_count INT NOT NULL DEFAULT 0,
    started_at DATETIME DEFAULT NULL,
    last_tick_at DATETIME DEFAULT NULL,
    expires_at DATETIME DEFAULT NULL,
    data LONGTEXT DEFAULT NULL,
    zone_name VARCHAR(255) DEFAULT NULL,
    difficulty INT DEFAULT NULL,
    factions TEXT DEFAULT NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_type_status (type, status),
    INDEX idx_user_type_status (user_id, type, status),
    CONSTRAINT fk_timers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE inventory_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    item_id VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    slot VARCHAR(32) DEFAULT NULL,
    quantity INT NOT NULL DEFAULT 1,
    equipped TINYINT(1) NOT NULL DEFAULT 0,
    data JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_user_item (user_id, item_id),
    INDEX idx_equipped (user_id, equipped),
    CONSTRAINT fk_inventory_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE base_upgrades (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    base_name VARCHAR(64) NOT NULL,
    class_name VARCHAR(64) NOT NULL,
    level INT NOT NULL DEFAULT 0,
    upgrading TINYINT(1) NOT NULL DEFAULT 0,
    timer_started_at DATETIME DEFAULT NULL,
    timer_duration INT DEFAULT NULL,
    timer_expires_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    UNIQUE KEY uk_user_base (user_id, base_name),
    CONSTRAINT fk_base_upg_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE base_effect_cooldowns (
    user_id INT UNSIGNED NOT NULL,
    effect_id VARCHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    INDEX idx_user (user_id),
    PRIMARY KEY (user_id, effect_id),
    CONSTRAINT fk_effect_cd_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE player_skills (
    user_id INT UNSIGNED NOT NULL,
    skill_id VARCHAR(64) NOT NULL,
    points INT NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, skill_id),
    CONSTRAINT fk_skills_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE bazaar_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    item_id VARCHAR(64) NOT NULL,
    data JSON NOT NULL,
    bought TINYINT(1) NOT NULL DEFAULT 0,
    refresh_at BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_user_bought (user_id, bought),
    CONSTRAINT fk_bazaar_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
