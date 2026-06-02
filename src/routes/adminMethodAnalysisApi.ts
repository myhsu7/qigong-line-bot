import { Router } from 'express';
import { getCommunityMethodSummary, searchUsersByName, getUserMethodAnalysis, buildUserMethodReview, MethodPeriod, getMethodPeriodRange } from '../services/methodStats';
import moment from 'moment-timezone';

const router = Router();

const isValidPeriod = (p: any): p is MethodPeriod => {
    return ['30d', '90d', 'month', 'quarter', 'year'].includes(p);
};

router.get('/summary', async (req, res) => {
    try {
        const period = isValidPeriod(req.query.period) ? req.query.period : '30d';
        const data = await getCommunityMethodSummary(period);
        const range = getMethodPeriodRange(period);

        res.json({
            periodMeta: {
                start: moment(range.start).format('YYYY-MM-DD'),
                end: moment(range.end).subtract(1, 'ms').format('YYYY-MM-DD')
            },
            ...data
        });
    } catch (e) {
        console.error('Error fetching method summary API:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/search-users', async (req, res) => {
    try {
        const q = req.query.q as string || '';
        if (q.length < 1) return res.json([]);
        const users = await searchUsersByName(q);
        res.json(users);
    } catch (e) {
        console.error('Error searching users:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/user', async (req, res) => {
    try {
        const userId = req.query.userId as string;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });

        const analysis30d = await getUserMethodAnalysis(userId, '30d');
        const analysis90d = await getUserMethodAnalysis(userId, '90d');
        const reviewText = buildUserMethodReview(analysis30d, analysis90d);

        res.json({
            '30d': analysis30d,
            '90d': analysis90d,
            reviewText
        });
    } catch (e) {
        console.error('Error fetching user method analysis:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
