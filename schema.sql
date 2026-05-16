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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS config (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT
);

-- Insert a placeholder for group_id so we can update it later
INSERT INTO config (key, value) VALUES ('group_id', NULL) ON CONFLICT (key) DO NOTHING;
