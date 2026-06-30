import { Request, Router } from 'express';
import { getPracticeMethods, getTodayLineCheckin, saveTodayLineCheckin, upsertLineUser, evaluateLineLiffBadges } from '../services/lineCheckin';

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

        const saved = await saveTodayLineCheckin(lineUserId, methodIds, reflectionNote, bodyFeelingNote);
        if (!saved.alreadyCheckedIn) {
            await evaluateLineLiffBadges(lineUserId, saved.selectedMethods);
        }
        res.json({ ok: true, ...saved });
    } catch (error) {
        console.error('[liff-api] failed to save checkin', error);
        res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to save check-in' });
    }
});

export default router;
