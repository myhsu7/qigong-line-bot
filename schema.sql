-- Database Schema for Qigong LINE Bot

CREATE TABLE IF NOT EXISTS users (
    line_user_id VARCHAR(255) PRIMARY KEY,
    display_name VARCHAR(255),
    total_checkins INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_checkin_date DATE
);

CREATE TABLE IF NOT EXISTS checkin_logs (
    id SERIAL PRIMARY KEY,
    line_user_id VARCHAR(255) REFERENCES users(line_user_id),
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    checkin_date DATE,
    reflection_note TEXT,
    body_feeling_note TEXT,
    source VARCHAR(32) DEFAULT 'text',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'checkin_logs_line_user_id_checkin_date_key'
    ) THEN
        ALTER TABLE checkin_logs
            ADD CONSTRAINT checkin_logs_line_user_id_checkin_date_key UNIQUE (line_user_id, checkin_date);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS config (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT
);

-- Insert a placeholder for group_id so we can update it later
INSERT INTO config (key, value) VALUES ('group_id', NULL) ON CONFLICT (key) DO NOTHING;

-- V2 Tables
CREATE TABLE IF NOT EXISTS active_groups (
    group_id VARCHAR(255) PRIMARY KEY,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS badges (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    emoji VARCHAR(50),
    description TEXT,
    category VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS user_badges (
    line_user_id VARCHAR(255) REFERENCES users(line_user_id),
    badge_id VARCHAR(50) REFERENCES badges(id),
    earned_year INTEGER,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (line_user_id, badge_id, earned_year)
);

-- Populate initial badge catalog
INSERT INTO badges (id, name, emoji, description, category) VALUES
    ('streak_3', '入門', '🥉', '連續打卡 3 天', 'STREAK'),
    ('streak_7', '小成', '🥈', '連續打卡 7 天', 'STREAK'),
    ('streak_21', '結丹', '🥇', '連續打卡 21 天', 'STREAK'),
    ('streak_100', '百日築基', '💎', '連續打卡 100 天', 'STREAK'),
    ('total_10', '初芽', '🌱', '總計打卡 10 天', 'TOTAL'),
    ('total_100', '大樹', '🌳', '總計打卡 100 天', 'TOTAL'),
    ('time_morning', '晨露', '🌅', '連續 5 天在早上 5:00 - 7:00 打卡', 'TIME_BASED'),
    ('time_night', '夜靜', '🦉', '連續 5 天在晚上 9:00 - 11:00 打卡', 'TIME_BASED'),
    ('seasonal_summer_27', '夏練三伏', '☀️', '夏至過後，連續打卡 27 天', 'SEASONAL'),
    ('seasonal_winter_27', '冬練三九', '❄️', '冬至過後，連續打卡 27 天，且練習龜壽功', 'SEASONAL')
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    emoji = EXCLUDED.emoji,
    description = EXCLUDED.description,
    category = EXCLUDED.category;

CREATE TABLE IF NOT EXISTS practice_methods (
    id SERIAL PRIMARY KEY,
    code VARCHAR(64) UNIQUE NOT NULL,
    name_zh VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    estimated_minutes INTEGER,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS checkin_method_selections (
    id SERIAL PRIMARY KEY,
    checkin_log_id INTEGER NOT NULL REFERENCES checkin_logs(id) ON DELETE CASCADE,
    practice_method_id INTEGER NOT NULL REFERENCES practice_methods(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (checkin_log_id, practice_method_id)
);

INSERT INTO practice_methods (code, name_zh, name_en, estimated_minutes, sort_order)
VALUES
    ('dayan', '大雁功', 'Dayan Qigong', 20, 10),
    ('wuqinxi', '五禽戲', 'Wuqinxi', 20, 20),
    ('huichun', '回春功', 'Huichun Gong', 20, 30),
    ('guishou', '龜壽功', 'Guishou Gong', 20, 40),
    ('zhengyang', '正陽功', 'Zhengyang Gong', 20, 50),
    ('huanghai', '神奇晃海功', 'Magic Swaying Sea Gong', 20, 60),
    ('lotus', '蓮花養心法', 'Lotus Heart Nourishing Method', 20, 70),
    ('heqi', '和氣舒壓法', 'Heqi Relaxation Method', 20, 80),
    ('sanwo', '三窩功', 'Sanwo Gong', 20, 90),
    ('liuyin', '六音理臟法', 'Liuyin Organ Tuning Method', 20, 100)
ON CONFLICT (code) DO UPDATE SET
    name_zh = EXCLUDED.name_zh,
    name_en = EXCLUDED.name_en,
    estimated_minutes = EXCLUDED.estimated_minutes,
    sort_order = EXCLUDED.sort_order,
    is_active = TRUE,
    updated_at = CURRENT_TIMESTAMP;
