import moment from 'moment-timezone';
import { db } from '../db';

const TIMEZONE = 'Asia/Taipei';

export type AdminPeriod = 'week' | 'month' | 'quarter' | 'year';

interface PeriodRange {
    start: Date;
    end: Date;
}

export const getAdminPeriodRange = (period: AdminPeriod): PeriodRange => {
    const now = moment().tz(TIMEZONE);
    let start, end;

    switch (period) {
        case 'week':
            start = now.clone().startOf('isoWeek');
            end = now.clone().endOf('isoWeek').add(1, 'millisecond');
            break;
        case 'month':
            start = now.clone().startOf('month');
            end = now.clone().endOf('month').add(1, 'millisecond');
            break;
        case 'quarter':
            start = now.clone().startOf('quarter');
            end = now.clone().endOf('quarter').add(1, 'millisecond');
            break;
        case 'year':
            start = now.clone().startOf('year');
            end = now.clone().endOf('year').add(1, 'millisecond');
            break;
        default:
            // fallback to week
            start = now.clone().startOf('isoWeek');
            end = now.clone().endOf('isoWeek').add(1, 'millisecond');
            break;
    }

    return { start: start.toDate(), end: end.toDate() };
};

export const getOverviewStats = async (period: AdminPeriod) => {
    const { start, end } = getAdminPeriodRange(period);

    // 1. Get KPI numbers
    const kpiQuery = `
        SELECT 
            COUNT(DISTINCT line_user_id) AS active_users,
            COUNT(DISTINCT line_user_id || DATE(created_at AT TIME ZONE $1)) AS total_checkins
        FROM checkin_logs
        WHERE created_at >= $2 AND created_at < $3
    `;
    const kpiRes = await db.query(kpiQuery, [TIMEZONE, start, end]);
    
    const activeUsers = parseInt(kpiRes.rows[0]?.active_users || '0');
    const totalCheckins = parseInt(kpiRes.rows[0]?.total_checkins || '0');
    
    const daysInPeriod = moment(end).diff(moment(start), 'days') || 1;
    const avgDailyCheckins = (totalCheckins / daysInPeriod).toFixed(1);

    // 2. Get daily trend for chart
    const trendQuery = `
        SELECT 
            DATE(created_at AT TIME ZONE $1) AS date_val,
            COUNT(DISTINCT line_user_id) AS daily_count
        FROM checkin_logs
        WHERE created_at >= $2 AND created_at < $3
        GROUP BY date_val
        ORDER BY date_val ASC
    `;
    const trendRes = await db.query(trendQuery, [TIMEZONE, start, end]);

    // Fill missing dates
    const trendData: { date: string, count: number }[] = [];
    let curr = moment(start);
    const stop = moment(end).subtract(1, 'day'); // end is exclusive, so subtract 1
    
    // Create map for quick lookup
    const queryMap = new Map();
    trendRes.rows.forEach(r => {
        const dStr = moment(r.date_val).format('YYYY-MM-DD');
        queryMap.set(dStr, parseInt(r.daily_count));
    });

    while (curr <= stop) {
        const dStr = curr.format('YYYY-MM-DD');
        trendData.push({
            date: dStr,
            count: queryMap.get(dStr) || 0
        });
        curr.add(1, 'day');
    }

    return {
        kpis: {
            activeUsers,
            totalCheckins,
            avgDailyCheckins
        },
        trend: trendData
    };
};

export const getLeaderboardStats = async (period: AdminPeriod) => {
    const { start, end } = getAdminPeriodRange(period);

    // Reuse the exact queries from the public leaderboard but optimized for admin
    const totalsQuery = `
        SELECT u.display_name, COUNT(DISTINCT DATE(c.created_at AT TIME ZONE $1)) AS total_days
        FROM checkin_logs c
        JOIN users u ON u.line_user_id = c.line_user_id
        WHERE c.created_at >= $2 AND c.created_at < $3
        GROUP BY u.display_name
        ORDER BY total_days DESC, u.display_name ASC
        LIMIT 10;
    `;
    const totalsRes = await db.query(totalsQuery, [TIMEZONE, start, end]);

    const streaksQuery = `
        SELECT c.line_user_id, u.display_name, DATE(c.created_at AT TIME ZONE $1) AS d
        FROM checkin_logs c
        JOIN users u ON u.line_user_id = c.line_user_id
        WHERE c.created_at >= $2 AND c.created_at < $3
        GROUP BY c.line_user_id, u.display_name, d
        ORDER BY c.line_user_id, d ASC;
    `;
    const streaksRes = await db.query(streaksQuery, [TIMEZONE, start, end]);
    
    // Compute max streaks using same logic
    let streaksData: any[] = [];
    if (streaksRes.rows.length > 0) {
        const userStreaks = new Map<string, { displayName: string, maxStreak: number }>();
        let currentUserId = '';
        let currentDisplayName = '';
        let currentStreak = 0;
        let maxStreak = 0;
        let lastDate: moment.Moment | null = null;

        const processingRows = [...streaksRes.rows, { line_user_id: 'dummy', display_name: '', d: '2000-01-01' }];

        for (const row of processingRows) {
            if (row.line_user_id !== currentUserId) {
                if (currentUserId !== '') {
                    userStreaks.set(currentUserId, { displayName: currentDisplayName, maxStreak });
                }
                currentUserId = row.line_user_id;
                currentDisplayName = row.display_name;
                currentStreak = 1;
                maxStreak = 1;
                lastDate = moment.tz(row.d, TIMEZONE);
            } else {
                const rowDate = moment.tz(row.d, TIMEZONE);
                if (lastDate && rowDate.diff(lastDate, 'days') === 1) {
                    currentStreak++;
                    if (currentStreak > maxStreak) maxStreak = currentStreak;
                } else {
                    currentStreak = 1;
                }
                lastDate = rowDate;
            }
        }

        streaksData = Array.from(userStreaks.values())
            .sort((a, b) => {
                if (b.maxStreak !== a.maxStreak) return b.maxStreak - a.maxStreak;
                return a.displayName.localeCompare(b.displayName);
            })
            .slice(0, 10);
    }

    return {
        totals: totalsRes.rows,
        streaks: streaksData
    };
};
