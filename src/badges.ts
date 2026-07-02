import { db } from './db';
import { messagingApi } from '@line/bot-sdk';
import moment from 'moment-timezone';
import { Solar, Lunar } from 'lunar-javascript';

const TIMEZONE = 'Asia/Taipei';

const lineConfig = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
    channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};

const client = new messagingApi.MessagingApiClient(lineConfig);

// Helper to check if a user already earned a specific badge this year
const hasEarnedBadge = async (userId: string, badgeId: string, year: number): Promise<boolean> => {
    const query = 'SELECT 1 FROM user_badges WHERE line_user_id = $1 AND badge_id = $2 AND earned_year = $3';
    const { rows } = await db.query(query, [userId, badgeId, year]);
    return rows.length > 0;
};

// Helper to award a badge
const awardBadge = async (userId: string, badgeId: string, year: number) => {
    // Double check to prevent race conditions
    if (await hasEarnedBadge(userId, badgeId, year)) return;

    await db.query(
        'INSERT INTO user_badges (line_user_id, badge_id, earned_year) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [userId, badgeId, year]
    );

    const { rows } = await db.query('SELECT name, emoji, description FROM badges WHERE id = $1', [badgeId]);
    if (rows.length > 0) {
        const badge = rows[0];
        const yearText = year !== 0 ? ` (${year}年)` : '';
        const msg = `🎉 恭喜！你解鎖了【${badge.emoji} ${badge.name}】成就${yearText}！\n\n條件：${badge.description}\n繼續保持這份毅力！💪`;
        
        try {
            await client.pushMessage({
                to: userId,
                messages: [{ type: 'text', text: msg }]
            });
        } catch (e) {
            console.error(`Failed to send badge notification to ${userId}:`, e);
        }
    }
};

// The Evaluation Engine
export const evaluateBadges = async (userId: string, text: string) => {
    const now = moment().tz(TIMEZONE);
    const currentYear = now.year();

    // 1. Fetch user stats
    const { rows: userRows } = await db.query('SELECT current_streak, total_checkins FROM users WHERE line_user_id = $1', [userId]);
    if (userRows.length === 0) return;
    const { current_streak, total_checkins } = userRows[0];

    // --- STREAK BADGES ---
    if (current_streak >= 3 && !(await hasEarnedBadge(userId, 'streak_3', 0))) await awardBadge(userId, 'streak_3', 0);
    if (current_streak >= 7 && !(await hasEarnedBadge(userId, 'streak_7', 0))) await awardBadge(userId, 'streak_7', 0);
    if (current_streak >= 21 && !(await hasEarnedBadge(userId, 'streak_21', 0))) await awardBadge(userId, 'streak_21', 0);
    if (current_streak >= 100 && !(await hasEarnedBadge(userId, 'streak_100', 0))) await awardBadge(userId, 'streak_100', 0);

    // --- TOTAL BADGES ---
    if (total_checkins >= 10 && !(await hasEarnedBadge(userId, 'total_10', 0))) await awardBadge(userId, 'total_10', 0);
    if (total_checkins >= 100 && !(await hasEarnedBadge(userId, 'total_100', 0))) await awardBadge(userId, 'total_100', 0);

    // --- TIME-BASED BADGES ---
    // Fetch last 5 check-ins to check the time window
    const { rows: recentLogs } = await db.query(
        'SELECT created_at FROM checkin_logs WHERE line_user_id = $1 ORDER BY created_at DESC LIMIT 5',
        [userId]
    );

    if (recentLogs.length === 5) {
        let allMorning = true;
        let allNight = true;

        // Check each of the last 5 logs for Morning Dew and Night Serenity
        for (const log of recentLogs) {
            const logTime = moment(log.created_at).tz(TIMEZONE);
            const hour = logTime.hour();
            
            if (hour < 5 || hour >= 7) allMorning = false;
            if (hour < 21 || hour >= 23) allNight = false;
        }

        if (allMorning && current_streak >= 5 && !(await hasEarnedBadge(userId, 'time_morning', 0))) {
            await awardBadge(userId, 'time_morning', 0);
        }
        
        if (allNight && current_streak >= 5 && !(await hasEarnedBadge(userId, 'time_night', 0))) {
            await awardBadge(userId, 'time_night', 0);
        }
    }

    // --- SEASONAL BADGES ---
    // Helper to get Solar Term exact date using Lunar.fromDate mapping
    const getJieQiDateStr = (year: number, jieQiName: string): string | null => {
        // Evaluate based on mid-year to get solstices for current Gregorian year
        const lunar = Lunar.fromDate(new Date(year, 6, 1));
        const jieQi = lunar.getJieQiTable()[jieQiName];
        return jieQi ? jieQi.toYmd() : null;
    };

    const summerSolsticeStr = getJieQiDateStr(currentYear, '夏至');
    if (summerSolsticeStr) {
        const summerSolstice = moment.tz(summerSolsticeStr, TIMEZONE);
        const daysSinceSummer = now.diff(summerSolstice, 'days');
        
        // If it's been exactly 27 days since summer solstice (27th day after)
        if (daysSinceSummer === 27) {
            if (!(await hasEarnedBadge(userId, 'seasonal_summer_27', currentYear))) {
                // Check if they checked in 27 times since the solstice
                const { rows } = await db.query(
                    'SELECT COUNT(DISTINCT DATE(created_at AT TIME ZONE $1)) as count FROM checkin_logs WHERE line_user_id = $2 AND created_at >= $3',
                    [TIMEZONE, userId, summerSolstice.toDate()]
                );
                if (parseInt(rows[0].count) >= 27) {
                    await awardBadge(userId, 'seasonal_summer_27', currentYear);
                }
            }
        }
    }

    const winterSolsticeStr = getJieQiDateStr(currentYear, 'DONG_ZHI'); // "冬至" inside lunar-javascript for end of year is DONG_ZHI
    if (winterSolsticeStr) {
        const winterSolstice = moment.tz(winterSolsticeStr, TIMEZONE);
        const daysSinceWinter = now.diff(winterSolstice, 'days');

        // Check if 27 days have passed since winter solstice
        if (daysSinceWinter === 27) {
            if (!(await hasEarnedBadge(userId, 'seasonal_winter_27', currentYear))) {
                const { rows } = await db.query(
                    `WITH guishou_days AS (
                        SELECT DISTINCT COALESCE(l.checkin_date, DATE(l.created_at AT TIME ZONE $1)) AS local_date
                        FROM checkin_logs l
                        LEFT JOIN checkin_method_selections s ON s.checkin_log_id = l.id
                        LEFT JOIN practice_methods pm ON pm.id = s.practice_method_id
                        WHERE l.line_user_id = $2
                          AND l.created_at >= $3
                          AND (
                              pm.code IN ('guishou', 'guishou_bagua', 'guishou_qiankun', 'guishou_fengxiang_guishuo')
                              OR COALESCE(l.note, '') LIKE ANY ($4::text[])
                          )
                    )
                    SELECT COUNT(*) AS count FROM guishou_days`,
                    [TIMEZONE, userId, winterSolstice.toDate(), ['%龜壽功%', '%八卦功%', '%乾坤功%', '%鳳翔與龜縮%']]
                );
                if (parseInt(rows[0].count) >= 27) {
                    await awardBadge(userId, 'seasonal_winter_27', currentYear);
                }
            }
        }
    }
};
