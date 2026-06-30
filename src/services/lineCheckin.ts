import moment from 'moment-timezone';
import { db } from '../db';
import { evaluateBadges } from '../badges';

const TIMEZONE = 'Asia/Taipei';

export interface LinePracticeMethod {
    id: number;
    code: string;
    nameZh: string;
    nameEn: string | null;
    estimatedMinutes: number | null;
}

export interface TodayLineCheckinResponse {
    date: string;
    alreadyCheckedIn: boolean;
    checkinLogId: number | null;
    selectedMethodIds: number[];
    reflectionNote: string;
    bodyFeelingNote: string;
}

export const upsertLineUser = async (lineUserId: string, displayName?: string | null) => {
    await db.query(
        `INSERT INTO users (line_user_id, display_name) VALUES ($1, $2)
         ON CONFLICT (line_user_id) DO UPDATE SET display_name = COALESCE($2, users.display_name)`,
        [lineUserId, displayName || null]
    );
};

export const getPracticeMethods = async (): Promise<LinePracticeMethod[]> => {
    const { rows } = await db.query(
        `SELECT id, code, name_zh, name_en, estimated_minutes
         FROM practice_methods
         WHERE is_active = TRUE
         ORDER BY sort_order ASC, id ASC`
    );

    return rows.map((row) => ({
        id: row.id,
        code: row.code,
        nameZh: row.name_zh,
        nameEn: row.name_en,
        estimatedMinutes: row.estimated_minutes
    }));
};

export const getTodayLineCheckin = async (lineUserId: string): Promise<TodayLineCheckinResponse> => {
    const today = moment().tz(TIMEZONE).format('YYYY-MM-DD');
    const { rows } = await db.query(
        `SELECT id, reflection_note, body_feeling_note
         FROM checkin_logs
         WHERE line_user_id = $1 AND checkin_date = $2`,
        [lineUserId, today]
    );

    if (rows.length === 0) {
        return {
            date: today,
            alreadyCheckedIn: false,
            checkinLogId: null,
            selectedMethodIds: [],
            reflectionNote: '',
            bodyFeelingNote: ''
        };
    }

    const checkin = rows[0];
    const selected = await db.query(
        `SELECT practice_method_id
         FROM checkin_method_selections
         WHERE checkin_log_id = $1
         ORDER BY practice_method_id ASC`,
        [checkin.id]
    );

    return {
        date: today,
        alreadyCheckedIn: true,
        checkinLogId: checkin.id,
        selectedMethodIds: selected.rows.map((r) => r.practice_method_id),
        reflectionNote: checkin.reflection_note || '',
        bodyFeelingNote: checkin.body_feeling_note || ''
    };
};

const buildLegacyNote = (methodNames: string[], reflectionNote: string, bodyFeelingNote: string) => {
    const parts: string[] = [];
    if (methodNames.length > 0) parts.push(`功法：${methodNames.join('、')}`);
    if (reflectionNote.trim()) parts.push(`心得：${reflectionNote.trim()}`);
    if (bodyFeelingNote.trim()) parts.push(`身體感受：${bodyFeelingNote.trim()}`);
    return parts.join('；');
};

export const saveTodayLineCheckin = async (
    lineUserId: string,
    methodIds: number[],
    reflectionNote: string,
    bodyFeelingNote: string
) => {
    if (methodIds.length === 0) {
        throw new Error('At least one practice method must be selected');
    }

    const today = moment().tz(TIMEZONE);
    const todayStr = today.format('YYYY-MM-DD');
    const yesterdayStr = today.clone().subtract(1, 'day').format('YYYY-MM-DD');
    const client = await db.getClient();

    try {
        await client.query('BEGIN');

        const methodRows = await client.query(
            `SELECT id, name_zh
             FROM practice_methods
             WHERE id = ANY($1::int[]) AND is_active = TRUE
             ORDER BY sort_order ASC, id ASC`,
            [methodIds]
        );

        if (methodRows.rows.length !== methodIds.length) {
            throw new Error('One or more selected practice methods are invalid');
        }

        const methodNames = methodRows.rows.map((row) => row.name_zh);
        const note = buildLegacyNote(methodNames, reflectionNote, bodyFeelingNote);

        const existing = await client.query(
            `SELECT id
             FROM checkin_logs
             WHERE line_user_id = $1 AND checkin_date = $2`,
            [lineUserId, todayStr]
        );

        let checkinLogId: number;
        let alreadyCheckedIn = false;
        let stats: { currentStreak: number; totalCheckins: number } | null = null;

        if (existing.rows.length > 0) {
            alreadyCheckedIn = true;
            checkinLogId = existing.rows[0].id;

            await client.query(
                `UPDATE checkin_logs
                 SET reflection_note = $1,
                     body_feeling_note = $2,
                     note = $3,
                     source = 'liff',
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $4`,
                [reflectionNote || null, bodyFeelingNote || null, note || null, checkinLogId]
            );

            await client.query(`DELETE FROM checkin_method_selections WHERE checkin_log_id = $1`, [checkinLogId]);

            const userStats = await client.query(
                `SELECT current_streak, total_checkins FROM users WHERE line_user_id = $1`,
                [lineUserId]
            );
            stats = {
                currentStreak: userStats.rows[0]?.current_streak || 0,
                totalCheckins: userStats.rows[0]?.total_checkins || 0
            };
        } else {
            const userRes = await client.query(
                `SELECT current_streak, longest_streak, last_checkin_date, total_checkins
                 FROM users WHERE line_user_id = $1`,
                [lineUserId]
            );
            const user = userRes.rows[0] || { current_streak: 0, longest_streak: 0, last_checkin_date: null, total_checkins: 0 };

            const inserted = await client.query(
                `INSERT INTO checkin_logs (line_user_id, checkin_date, reflection_note, body_feeling_note, note, source)
                 VALUES ($1, $2, $3, $4, $5, 'liff')
                 RETURNING id`,
                [lineUserId, todayStr, reflectionNote || null, bodyFeelingNote || null, note || null]
            );
            checkinLogId = inserted.rows[0].id;

            const lastCheckinDate = user.last_checkin_date ? moment(user.last_checkin_date).tz(TIMEZONE).format('YYYY-MM-DD') : null;
            let newStreak = 1;
            if (lastCheckinDate === yesterdayStr) {
                newStreak = (user.current_streak || 0) + 1;
            }
            const newLongestStreak = Math.max(newStreak, user.longest_streak || 0);
            const newTotal = (user.total_checkins || 0) + 1;

            await client.query(
                `UPDATE users
                 SET current_streak = $1,
                     longest_streak = $2,
                     total_checkins = $3,
                     last_checkin_date = $4
                 WHERE line_user_id = $5`,
                [newStreak, newLongestStreak, newTotal, todayStr, lineUserId]
            );

            stats = {
                currentStreak: newStreak,
                totalCheckins: newTotal
            };
        }

        for (const methodId of methodIds) {
            await client.query(
                `INSERT INTO checkin_method_selections (checkin_log_id, practice_method_id)
                 VALUES ($1, $2)
                 ON CONFLICT (checkin_log_id, practice_method_id) DO NOTHING`,
                [checkinLogId, methodId]
            );
        }

        await client.query('COMMIT');

        return {
            date: todayStr,
            checkinLogId,
            alreadyCheckedIn,
            selectedMethods: methodNames,
            stats
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

export const evaluateLineLiffBadges = async (lineUserId: string, selectedMethods: string[]) => {
    const note = buildLegacyNote(selectedMethods, '', '');
    await evaluateBadges(lineUserId, note);
};
