-- Migration script from v1 to v2

-- 1. Create new tables
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

-- 2. Migrate existing group from config table to active_groups
INSERT INTO active_groups (group_id)
SELECT value FROM config WHERE key = 'group_id' AND value IS NOT NULL
ON CONFLICT (group_id) DO NOTHING;

-- 3. Populate initial badge catalog into the badges table
INSERT INTO badges (id, name, emoji, description, category) VALUES
    ('streak_3', '入門', '🥉', '連續打卡 3 天', 'STREAK'),
    ('streak_7', '小成', '🥈', '連續打卡 7 天', 'STREAK'),
    ('streak_21', '結丹', '🥇', '連續打卡 21 天', 'STREAK'),
    ('streak_100', '百日築基', '💎', '連續打卡 100 天', 'STREAK'),
    ('total_10', '初芽', '🌱', '總計打卡 10 天', 'TOTAL'),
    ('total_100', '大樹', '🌳', '總計打卡 100 天', 'TOTAL'),
    ('time_morning', '晨露', '🌅', '連續 5 天在早上 5:00 - 7:00 打卡', 'TIME_BASED'),
    ('time_night', '夜靜', '🦉', '連續 5 天在晚上 9:00 - 11:00 打卡', 'TIME_BASED'),
    ('seasonal_summer_27', '夏練三伏', '☀️', '於當年三伏期間完成全程打卡', 'SEASONAL'),
    ('seasonal_winter_27', '冬練三九', '❄️', '冬至過後，連續打卡 27 天，且練習龜壽功', 'SEASONAL')
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    emoji = EXCLUDED.emoji,
    description = EXCLUDED.description,
    category = EXCLUDED.category;
