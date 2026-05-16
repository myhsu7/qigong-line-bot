import express from 'express';
import { middleware } from '@line/bot-sdk';
import * as dotenv from 'dotenv';
import cron from 'node-cron';
import { handleEvent } from './bot';
import { sendDailyReminder } from './cron';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

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
