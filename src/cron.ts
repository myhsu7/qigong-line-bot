import { db } from './db';
import { Lunar } from 'lunar-javascript';
import { messagingApi } from '@line/bot-sdk';
import moment from 'moment-timezone';

const TIMEZONE = 'Asia/Taipei';

const lineConfig = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
    channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};

const client = new messagingApi.MessagingApiClient(lineConfig);

export const sendDailyReminder = async () => {
    try {
        const { rows } = await db.query("SELECT value FROM config WHERE key = 'group_id'");
        const groupId = rows[0]?.value;

        if (!groupId) {
            console.log('No group_id found in config. Cannot send reminder.');
            return;
        }

        // Generate Solar Term (節氣) Info
        const today = new Date();
        const lunar = Lunar.fromDate(today);
        let solarTermMsg = '';
        
        const currentJieQi = lunar.getJieQi();
        const nextJieQi = lunar.getNextJieQi();
        
        if (currentJieQi) {
            solarTermMsg = `今天是${currentJieQi}！`;
        } else {
            const nextJieQiDate = nextJieQi.getSolar().toYmd();
            solarTermMsg = `距離下一個節氣「${nextJieQi.getName()}」還有幾天 (${nextJieQiDate})。`;
        }

        // Leaderboard Highlight (e.g. random top 3 streaks)
        const leaderResult = await db.query(
            "SELECT display_name, current_streak FROM users WHERE current_streak > 0 ORDER BY RANDOM() LIMIT 3"
        );
        
        let leaderMsg = '';
        if (leaderResult.rows.length > 0) {
            leaderMsg = '🔥 今日精進榜：\n' + leaderResult.rows.map(r => `• ${r.display_name} - 連續 ${r.current_streak} 天`).join('\n');
        } else {
            leaderMsg = '大家快來打卡，開啟你的練功連勝紀錄吧！';
        }

        const messageText = `🌙 晚安！氣功時間到了！\n\n${solarTermMsg}\n\n「練功如春起之苗，不見其增，日有所長。」\n大家今天練習了嗎？記得去 1對1 聊天室打卡喔！\n\n${leaderMsg}`;

        await client.pushMessage({
            to: groupId,
            messages: [{ type: 'text', text: messageText }]
        });

        console.log(`Daily reminder sent successfully to ${groupId}`);
    } catch (error) {
        console.error('Error sending daily reminder:', error);
    }
};
