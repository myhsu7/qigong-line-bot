import { Router } from 'express';
import { getOverviewStats, getLeaderboardStats, AdminPeriod, getAdminPeriodRange } from '../services/adminStats';
import moment from 'moment-timezone';

const router = Router();

const isValidPeriod = (p: any): p is AdminPeriod => {
    return ['week', 'month', 'quarter', 'year'].includes(p);
};

// Overview Page
router.get('/', async (req, res) => {
    const period = isValidPeriod(req.query.period) ? req.query.period : 'week';
    
    try {
        const data = await getOverviewStats(period);
        const range = getAdminPeriodRange(period);
        
        res.render('admin/overview', {
            i18n: req.i18n,
            lang: req.langCode,
            currentPeriod: period,
            dateRange: `${moment(range.start).format('YYYY-MM-DD')} ~ ${moment(range.end).subtract(1, 'ms').format('YYYY-MM-DD')}`,
            data,
            path: '/line/admin-dashboard'
        });
    } catch (e) {
        console.error('Error rendering admin overview page:', e);
        res.status(500).send('Server Error');
    }
});

// Leaderboard Page
router.get('/leaderboard', async (req, res) => {
    const period = isValidPeriod(req.query.period) ? req.query.period : 'week';
    
    try {
        const data = await getLeaderboardStats(period);
        const range = getAdminPeriodRange(period);
        
        res.render('admin/leaderboard', {
            i18n: req.i18n,
            lang: req.langCode,
            currentPeriod: period,
            dateRange: `${moment(range.start).format('YYYY-MM-DD')} ~ ${moment(range.end).subtract(1, 'ms').format('YYYY-MM-DD')}`,
            data,
            path: '/line/admin-dashboard/leaderboard'
        });
    } catch (e) {
        console.error('Error rendering admin leaderboard page:', e);
        res.status(500).send('Server Error');
    }
});

export default router;
