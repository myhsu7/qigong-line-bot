import { Router } from 'express';

const router = Router();

router.get('/checkin', (req, res) => {
    const page = typeof req.query.page === 'string' ? req.query.page : '';
    const period = typeof req.query.period === 'string' ? req.query.period : '';

    if (page === 'leaderboard') {
        const query = period ? `?period=${encodeURIComponent(period)}` : '';
        return res.redirect(`/line/liff/leaderboard${query}`);
    }

    if (page === 'history') {
        return res.redirect('/line/liff/history');
    }

    res.render('liff/checkin', {
        liffId: process.env.LIFF_ID || '',
        path: '/line/liff/checkin'
    });
});

router.get('/leaderboard', (req, res) => {
    res.render('liff/leaderboard', {
        liffId: process.env.LIFF_ID || '',
        path: '/line/liff/leaderboard'
    });
});

router.get('/history', (req, res) => {
    res.render('liff/history', {
        liffId: process.env.LIFF_ID || '',
        path: '/line/liff/history'
    });
});

export default router;
