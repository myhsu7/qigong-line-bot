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

        const methodIds = parseMethodIds(req.body?.methodIds);
        const reflectionNote = typeof req.body?.reflectionNote === 'string' ? req.body.reflectionNote : '';
        const bodyFeelingNote = typeof req.body?.bodyFeelingNote === 'string' ? req.body.bodyFeelingNote : '';

        console.log('[liff-api] save checkin payload', {
            lineUserId,
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
