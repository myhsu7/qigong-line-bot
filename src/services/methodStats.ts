import moment from 'moment-timezone';
import { db } from '../db';

const TIMEZONE = 'Asia/Taipei';

// 1. Method Dictionary Definition
export const methodDictionary = [
    { name: '大雁功', aliases: ['大雁功'] },
    { name: '回春功', aliases: ['回春功'] },
    { name: '龜壽功', aliases: ['龜壽功'] },
    { name: '正陽功', aliases: ['正陽功'] },
    { name: '神奇晃海功', aliases: ['神奇晃海功', '晃海功', '晃海'] },
    { name: '和氣舒壓法', aliases: ['和氣舒壓法', '和氣', '舒壓法'] },
    { name: '蓮花', aliases: ['蓮花', '蓮花功'] }
];

export type MethodPeriod = '30d' | '90d' | 'month' | 'quarter' | 'year';

interface PeriodRange {
    start: Date;
    end: Date;
}

export const getMethodPeriodRange = (period: MethodPeriod): PeriodRange => {
    const now = moment().tz(TIMEZONE);
    let start, end;

    switch (period) {
        case '30d':
            start = now.clone().subtract(30, 'days').startOf('day');
            end = now.clone().add(1, 'millisecond'); // Up to now
            break;
        case '90d':
            start = now.clone().subtract(90, 'days').startOf('day');
            end = now.clone().add(1, 'millisecond');
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
            start = now.clone().subtract(30, 'days').startOf('day');
            end = now.clone().add(1, 'millisecond');
            break;
    }
    return { start: start.toDate(), end: end.toDate() };
};

// Helper: generate CTE for dictionary to join with
const getDictCTE = () => {
    const values = methodDictionary.map(m => `('${m.name}', ARRAY[${m.aliases.map(a => `'${a}'`).join(',')}])`).join(',\n');
    return `
        WITH method_dict AS (
            SELECT * FROM (VALUES ${values}) AS t(method_name, aliases)
        )
    `;
};

export const getCommunityMethodSummary = async (period: MethodPeriod = '30d') => {
    const { start, end } = getMethodPeriodRange(period);
    
    // Total checkin days for community in period
    const totalDaysQuery = `
        SELECT COUNT(DISTINCT line_user_id || DATE(created_at AT TIME ZONE $1)) AS total_checkin_days
        FROM checkin_logs
        WHERE created_at >= $2 AND created_at < $3
    `;
    const totalRes = await db.query(totalDaysQuery, [TIMEZONE, start, end]);
    const totalCheckinDays = parseInt(totalRes.rows[0]?.total_checkin_days || '0');

    const query = `
        ${getDictCTE()},
        logs AS (
            SELECT line_user_id, (created_at AT TIME ZONE $1)::date AS local_date, COALESCE(note, '') AS note
            FROM checkin_logs
            WHERE created_at >= $2 AND created_at < $3
        ),
        matched AS (
            SELECT DISTINCT l.line_user_id, l.local_date, md.method_name
            FROM logs l
            JOIN method_dict md ON EXISTS (
                SELECT 1 FROM unnest(md.aliases) a WHERE l.note ILIKE '%' || a || '%'
            )
        )
        SELECT method_name, COUNT(*) AS matched_days
        FROM matched
        GROUP BY method_name
        ORDER BY matched_days DESC
    `;
    const { rows } = await db.query(query, [TIMEZONE, start, end]);
    
    const totalMatched = rows.reduce((sum, r) => sum + parseInt(r.matched_days), 0);
    
    const methodDistribution = rows.map(r => ({
        methodName: r.method_name,
        matchedDays: parseInt(r.matched_days),
        compositionRatio: totalMatched > 0 ? (parseInt(r.matched_days) / totalMatched) : 0
    }));

    return {
        totalCheckinDays,
        totalMatchedMethodDays: totalMatched,
        methodDistribution
    };
};

export const searchUsersByName = async (keyword: string) => {
    const { rows } = await db.query(`
        SELECT line_user_id, display_name 
        FROM users 
        WHERE display_name ILIKE $1 
        ORDER BY total_checkins DESC 
        LIMIT 20
    `, [`%${keyword}%`]);
    return rows;
};

export const getUserMethodAnalysis = async (userId: string, period: MethodPeriod) => {
    const { start, end } = getMethodPeriodRange(period);

    const totalDaysQuery = `
        SELECT COUNT(DISTINCT DATE(created_at AT TIME ZONE $1)) AS total_checkin_days
        FROM checkin_logs
        WHERE line_user_id = $2 AND created_at >= $3 AND created_at < $4
    `;
    const totalRes = await db.query(totalDaysQuery, [TIMEZONE, userId, start, end]);
    const totalCheckinDays = parseInt(totalRes.rows[0]?.total_checkin_days || '0');

    const query = `
        ${getDictCTE()},
        logs AS (
            SELECT (created_at AT TIME ZONE $1)::date AS local_date, COALESCE(note, '') AS note
            FROM checkin_logs
            WHERE line_user_id = $2 AND created_at >= $3 AND created_at < $4
        ),
        matched AS (
            SELECT DISTINCT l.local_date, md.method_name
            FROM logs l
            JOIN method_dict md ON EXISTS (
                SELECT 1 FROM unnest(md.aliases) a WHERE l.note ILIKE '%' || a || '%'
            )
        )
        SELECT method_name, COUNT(*) AS matched_days
        FROM matched
        GROUP BY method_name
        ORDER BY matched_days DESC
    `;
    const { rows } = await db.query(query, [TIMEZONE, userId, start, end]);

    const totalMatched = rows.reduce((sum, r) => sum + parseInt(r.matched_days), 0);

    const methods = rows.map(r => {
        const matchedDays = parseInt(r.matched_days);
        return {
            methodName: r.method_name,
            matchedDays,
            attendanceRatio: totalCheckinDays > 0 ? (matchedDays / totalCheckinDays) : 0,
            compositionRatio: totalMatched > 0 ? (matchedDays / totalMatched) : 0
        };
    });

    return {
        totalCheckinDays,
        totalMatchedMethodDays: totalMatched,
        methods,
        top3Methods: methods.slice(0, 3)
    };
};

export const buildUserMethodReview = (analysis30d: any, analysis90d: any): string => {
    if (analysis30d.methods.length === 0) {
        return "最近 30 天內沒有辨識到任何特定的功法紀錄，請記得在打卡時填寫功法名稱喔！";
    }

    const topMethod = analysis30d.top3Methods[0];
    let review = "";

    // Classification based on composition ratio of top method
    if (topMethod.compositionRatio >= 0.6) {
        review = `你最近以「${topMethod.methodName}」為主，練功重心很明確，節奏相當穩定。`;
    } else if (analysis30d.methods.length >= 3 && topMethod.compositionRatio <= 0.4) {
        review = `你最近各功法分布相對平均，整體練功配置相當均衡。`;
    } else {
        review = `你最近主要修練「${topMethod.methodName}」，搭配其他功法輔助，維持得很好。`;
    }

    // Compare with 90d if available
    if (analysis90d.methods.length > 0) {
        const top90d = analysis90d.top3Methods[0];
        if (topMethod.methodName !== top90d.methodName) {
            review += ` 相比過去 90 天，你的重心從「${top90d.methodName}」轉移了，是一個新的修練階段。`;
        }
    }

    // Recommendation (randomly pick one they haven't practiced much)
    const allDictNames = methodDictionary.map(m => m.name);
    const practicedNames = analysis30d.methods.map((m: any) => m.methodName);
    const unpracticed = allDictNames.filter(name => !practicedNames.includes(name));
    
    if (unpracticed.length > 0 && topMethod.compositionRatio > 0.5) {
        review += `\n💡 下個階段可適度加入「${unpracticed[0]}」，讓舒展與調和更完整。`;
    }

    return review;
};
