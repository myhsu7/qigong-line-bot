import { Router } from 'express';

const router = Router();

router.get('/checkin', (req, res) => {
    res.render('liff/checkin', {
        liffId: process.env.LIFF_ID || '',
        path: '/line/liff/checkin'
    });
});

export default router;
