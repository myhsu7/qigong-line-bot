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

    if (page === 'method-analysis') {
        return res.redirect('/line/liff/method-analysis');
    }

    if (page === 'achievements') {
        return res.redirect('/line/liff/achievements');
    }

    if (page === 'reminder') {
        return res.redirect('/line/liff/reminder');
    }

    res.render('liff/checkin', {
        liffId: process.env.LIFF_ID_CHECKIN || process.env.LIFF_ID || '',
        path: '/line/liff/checkin'
    });
});

router.get('/leaderboard', (req, res) => {
    res.render('liff/leaderboard', {
        liffId: process.env.LIFF_ID_LEADERBOARD || process.env.LIFF_ID || '',
        path: '/line/liff/leaderboard'
    });
});

router.get('/history', (req, res) => {
    res.render('liff/history', {
        liffId: process.env.LIFF_ID_HISTORY || process.env.LIFF_ID || '',
        path: '/line/liff/history'
    });
});

router.get('/method-analysis', (req, res) => {
    res.render('liff/method-analysis', {
        liffId: process.env.LIFF_ID_METHOD_ANALYSIS || process.env.LIFF_ID || '',
        path: '/line/liff/method-analysis'
    });
});

router.get('/achievements', (req, res) => {
    res.render('liff/achievements', {
        liffId: process.env.LIFF_ID_ACHIEVEMENTS || process.env.LIFF_ID || '',
        path: '/line/liff/achievements'
    });
});

router.get('/reminder', (req, res) => {
    res.render('liff/reminder', {
        liffId: process.env.LIFF_ID_REMINDER || process.env.LIFF_ID || '',
        path: '/line/liff/reminder'
    });
});

export default router;
