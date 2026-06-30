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

ALTER TABLE checkin_logs
    ADD COLUMN IF NOT EXISTS checkin_date DATE,
    ADD COLUMN IF NOT EXISTS reflection_note TEXT,
    ADD COLUMN IF NOT EXISTS body_feeling_note TEXT,
    ADD COLUMN IF NOT EXISTS source VARCHAR(32) DEFAULT 'text',
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

UPDATE checkin_logs
SET checkin_date = COALESCE(checkin_date, (created_at AT TIME ZONE 'Asia/Taipei')::date),
    updated_at = COALESCE(updated_at, created_at)
WHERE checkin_date IS NULL OR updated_at IS NULL;

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
