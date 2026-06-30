import { Router } from 'express';

const router = Router();

router.get('/checkin', (req, res) => {
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
