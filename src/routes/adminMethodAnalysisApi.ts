import { Router } from 'express';
import { getCommunityMethodSummary, searchUsersByName, getUserMethodAnalysis, getUserPracticeJournal, buildUserMethodReview, MethodPeriod, getMethodPeriodRange } from '../services/methodStats';
import moment from 'moment-timezone';
import { generateMethodReviewWithLlm } from '../services/methodReviewLlm';

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

        const [analysis30d, analysis90d, journal] = await Promise.all([
            getUserMethodAnalysis(userId, '30d'),
            getUserMethodAnalysis(userId, '90d'),
            getUserPracticeJournal(userId)
        ]);
        const fallbackReviewText = buildUserMethodReview(analysis30d, analysis90d);
        const reviewText = await generateMethodReviewWithLlm(analysis30d, fallbackReviewText, userId);

        res.json({
            '30d': analysis30d,
            '90d': analysis90d,
            reviewText,
            journal
        });
    } catch (e) {
        console.error('Error fetching user method analysis:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
