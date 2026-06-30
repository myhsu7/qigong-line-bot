import { Request, Router } from 'express';
import { getPracticeMethods, getTodayLineCheckin, saveTodayLineCheckin, upsertLineUser, evaluateLineLiffBadges } from '../services/lineCheckin';
import { db } from '../db';

const router = Router();

const parseMethodIds = (raw: unknown): number[] => {
    if (Array.isArray(raw)) {
        return raw.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
    }

    if (typeof raw === 'string') {
        return raw
            .split(',')
            .map((id) => Number(id.trim()))
            .filter((id) => Number.isFinite(id) && id > 0);
    }

    if (raw && typeof raw === 'object') {
        return Object.values(raw as Record<string, unknown>)
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id) && id > 0);
    }

    return [];
};

const parseMethodIdsFromRequest = (req: Request): number[] => {
    const direct = parseMethodIds(req.body?.methodIds);
    if (direct.length > 0) return direct;

    const csv = req.body?.methodIdsCsv || req.body?.selectedMethodIdsCsv || req.query?.methodIdsCsv;
    const fromCsv = parseMethodIds(csv);
    if (fromCsv.length > 0) return fromCsv;

    const bracketKeys = Object.keys(req.body || {})
        .filter((key) => key.startsWith('methodIds['))
        .sort();
    if (bracketKeys.length > 0) {
        const values = bracketKeys.map((key) => req.body[key]);
        const fromBracketKeys = parseMethodIds(values);
        if (fromBracketKeys.length > 0) return fromBracketKeys;
    }

    return [];
};

const resolveLineUser = (req: Request) => {
    const lineUserId = (req.header('x-line-user-id') || req.body?.lineUserId || req.query?.lineUserId || '').toString();
    const displayName = (req.header('x-line-display-name') || req.body?.displayName || req.query?.displayName || '').toString();
    return { lineUserId, displayName };
};

const getUserBadgesSnapshot = async (lineUserId: string) => {
    const { rows } = await db.query(
        `SELECT ub.badge_id, ub.earned_year, b.name, b.emoji, b.description
         FROM user_badges ub
         JOIN badges b ON b.id = ub.badge_id
         WHERE ub.line_user_id = $1`,
        [lineUserId]
    );

    return rows.map((row) => ({
        key: `${row.badge_id}:${row.earned_year}`,
        badgeId: row.badge_id,
        earnedYear: row.earned_year,
        name: row.name,
        emoji: row.emoji || '',
        description: row.description || ''
    }));
};

router.get('/practice-methods', async (req, res) => {
    try {
        const methods = await getPracticeMethods();
        res.json({ methods });
    } catch (error) {
        console.error('[liff-api] failed to load practice methods', error);
        res.status(500).json({ error: 'Failed to load practice methods' });
    }
});

router.get('/checkin/today', async (req, res) => {
    try {
        const { lineUserId, displayName } = resolveLineUser(req);
        if (!lineUserId) return res.status(400).json({ error: 'Missing lineUserId' });
        await upsertLineUser(lineUserId, displayName || null);
        const data = await getTodayLineCheckin(lineUserId);
        res.json(data);
    } catch (error) {
        console.error('[liff-api] failed to load today checkin', error);
        res.status(500).json({ error: 'Failed to load today checkin' });
    }
});

router.post('/checkin', async (req, res) => {
    try {
        const { lineUserId, displayName } = resolveLineUser(req);
        if (!lineUserId) return res.status(400).json({ error: 'Missing lineUserId' });
        await upsertLineUser(lineUserId, displayName || null);

        const methodIds = parseMethodIdsFromRequest(req);
        const reflectionNote = typeof req.body?.reflectionNote === 'string' ? req.body.reflectionNote : '';
        const bodyFeelingNote = typeof req.body?.bodyFeelingNote === 'string' ? req.body.bodyFeelingNote : '';

        console.log('[liff-api] save checkin payload', {
            lineUserId,
            contentType: req.headers['content-type'],
            rawBodyKeys: Object.keys(req.body || {}),
            rawMethodIds: req.body?.methodIds,
            rawMethodIdsCsv: req.body?.methodIdsCsv,
            methodIds,
            methodCount: req.body?.methodCount,
            reflectionLength: reflectionNote.length,
            bodyFeelingLength: bodyFeelingNote.length
        });

        const beforeBadges = await getUserBadgesSnapshot(lineUserId);
        const beforeBadgeKeys = new Set(beforeBadges.map((badge) => badge.key));

        const saved = await saveTodayLineCheckin(lineUserId, methodIds, reflectionNote, bodyFeelingNote);
        let unlockedBadges: Array<{ badgeId: string; earnedYear: number; name: string; emoji: string; description: string }> = [];
        if (!saved.alreadyCheckedIn) {
            await evaluateLineLiffBadges(lineUserId, saved.selectedMethods);
            const afterBadges = await getUserBadgesSnapshot(lineUserId);
            unlockedBadges = afterBadges
                .filter((badge) => !beforeBadgeKeys.has(badge.key))
                .map(({ key, ...badge }) => badge);
        }
        res.json({ ok: true, ...saved, unlockedBadges });
    } catch (error) {
        console.error('[liff-api] failed to save checkin', error);
        res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to save check-in' });
    }
});

export default router;
