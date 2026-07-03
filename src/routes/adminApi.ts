import { Request, Router } from 'express';
import { getOverviewStats, getLeaderboardStats, AdminPeriod, getAdminPeriodRange, getTodayCheckedInUsers, getTodayPendingUsers } from '../services/adminStats';
import moment from 'moment-timezone';

const router = Router();

// Define allowed periods
const isValidPeriod = (p: any): p is AdminPeriod => {
    return ['week', 'month', 'quarter', 'year'].includes(p);
};

router.get('/overview', async (req, res) => {
    try {
        const period = req.query.period as string;
        if (!isValidPeriod(period)) {
            return res.status(400).json({ error: 'Invalid period. Use week, month, quarter, or year.' });
        }

        const data = await getOverviewStats(period);
        const range = getAdminPeriodRange(period);

        res.json({
            periodMeta: {
                start: moment(range.start).format('YYYY-MM-DD'),
                end: moment(range.end).subtract(1, 'ms').format('YYYY-MM-DD')
            },
            ...data
        });
    } catch (e) {
        console.error('Error fetching admin overview API:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/leaderboard', async (req, res) => {
    try {
        const period = req.query.period as string;
        if (!isValidPeriod(period)) {
            return res.status(400).json({ error: 'Invalid period. Use week, month, quarter, or year.' });
        }

        const data = await getLeaderboardStats(period);
        const range = getAdminPeriodRange(period);

        res.json({
            periodMeta: {
                start: moment(range.start).format('YYYY-MM-DD'),
                end: moment(range.end).subtract(1, 'ms').format('YYYY-MM-DD')
            },
            ...data
        });
    } catch (e) {
        console.error('Error fetching admin leaderboard API:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

const parsePage = (req: Request) => {
    const page = parseInt((req.query.page as string) || '1', 10);
    return Number.isFinite(page) && page > 0 ? page : 1;
};

const parseLimit = (req: Request) => {
    const limit = parseInt((req.query.limit as string) || '20', 10);
    return Number.isFinite(limit) && limit > 0 && limit <= 100 ? limit : 20;
};

router.get('/today-checkins', async (req, res) => {
    try {
        const data = await getTodayCheckedInUsers(parsePage(req), parseLimit(req));
        res.json(data);
    } catch (e) {
        console.error('Error fetching today checkins API:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/today-pending', async (req, res) => {
    try {
        const data = await getTodayPendingUsers(parsePage(req), parseLimit(req));
        res.json(data);
    } catch (e) {
        console.error('Error fetching today pending API:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
