import express from 'express';
import { middleware } from '@line/bot-sdk';
import * as dotenv from 'dotenv';
import cron from 'node-cron';
import path from 'path';
import { handleEvent } from './bot';
import { sendDailyReminder } from './cron';

import { requireTailscaleInternal, requireAdminBasicAuth } from './middleware/adminSecurity';
import { resolveLanguage } from './middleware/i18n';
import adminApiRoutes from './routes/adminApi';
import adminPagesRoutes from './routes/adminPages';
import adminMethodAnalysisApiRoutes from './routes/adminMethodAnalysisApi';
import adminMethodAnalysisPagesRoutes from './routes/adminMethodAnalysisPages';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Setup EJS for Admin Dashboard
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const config = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
    channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};

app.post('/webhook', middleware(config), (req, res) => {
    Promise
        .all(req.body.events.map(handleEvent))
        .then((result) => res.json(result))
        .catch((err) => {
            console.error(err);
            res.status(500).end();
        });
});

// Admin Dashboard Routes
const adminMiddleware = [requireTailscaleInternal, requireAdminBasicAuth, resolveLanguage];
app.use('/admin-dashboard/method-analysis', adminMiddleware, adminMethodAnalysisPagesRoutes);
app.use('/admin-dashboard', adminMiddleware, adminPagesRoutes);
app.use('/api/admin/method-analysis', adminMiddleware, adminMethodAnalysisApiRoutes);
app.use('/api/admin', adminMiddleware, adminApiRoutes);

app.get('/', (req, res) => {
    res.send('Qigong LINE Bot is running.');
});

// Setup cron job (Run every day at 20:00 Asia/Taipei)
cron.schedule('0 20 * * *', () => {
    console.log('Running daily reminder cron job...');
    sendDailyReminder();
}, {
    timezone: "Asia/Taipei"
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Cron job scheduled for 20:00 Asia/Taipei`);
});
