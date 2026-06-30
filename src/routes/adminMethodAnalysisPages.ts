import { Router } from 'express';
import { getCommunityMethodSummary, MethodPeriod, getMethodPeriodRange } from '../services/methodStats';
import moment from 'moment-timezone';

const router = Router();

const isValidPeriod = (p: any): p is MethodPeriod => {
    return ['30d', '90d', 'month', 'quarter', 'year'].includes(p);
};

router.get('/', async (req, res) => {
    const period = isValidPeriod(req.query.period) ? req.query.period : '30d';
    
    try {
        const data = await getCommunityMethodSummary(period);
        const range = getMethodPeriodRange(period);
        
        res.render('admin/method-analysis', {
            i18n: req.i18n,
            lang: req.langCode,
            currentPeriod: period,
            dateRange: `${moment(range.start).format('YYYY-MM-DD')} ~ ${moment(range.end).subtract(1, 'ms').format('YYYY-MM-DD')}`,
            data,
            path: '/line/admin-dashboard/method-analysis'
        });
    } catch (e) {
        console.error('Error rendering admin method analysis page:', e);
        res.status(500).send('Server Error');
    }
});

export default router;
