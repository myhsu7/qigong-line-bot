import { db } from './db';
import { Lunar } from 'lunar-javascript';
import { messagingApi } from '@line/bot-sdk';
import moment from 'moment-timezone';

import { getDailyWisdom } from './content/wisdom';
import { getSolarTermGuide } from './content/solarTerms';

const TIMEZONE = 'Asia/Taipei';
const LIFF_ID = process.env.LIFF_ID || '';
const CHECKIN_SHORTCUT_URL = LIFF_ID ? `https://liff.line.me/${LIFF_ID}` : (process.env.LINE_LIFF_CHECKIN_URL || '');

const lineConfig = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
    channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};

const client = new messagingApi.MessagingApiClient(lineConfig);

// Helper to get Solar Term exact date using Lunar.fromDate mapping
const getJieQiDateStr = (year: number, jieQiName: string): string | null => {
    const lunar = Lunar.fromDate(new Date(year, 6, 1));
    const jieQi = lunar.getJieQiTable()[jieQiName];
    return jieQi ? jieQi.toYmd() : null;
};

const isSummerChallengePeriod = (now: moment.Moment): boolean => {
    const summerSolsticeStr = getJieQiDateStr(now.year(), '夏至');
    if (!summerSolsticeStr) return false;
    const summerSolstice = moment.tz(summerSolsticeStr, TIMEZONE);
    const daysSince = now.diff(summerSolstice, 'days');
    return daysSince >= 0 && daysSince <= 27;
};

const isWinterChallengePeriod = (now: moment.Moment): boolean => {
    const winterSolsticeStr = getJieQiDateStr(now.year(), 'DONG_ZHI');
    if (!winterSolsticeStr) return false;
    const winterSolstice = moment.tz(winterSolsticeStr, TIMEZONE);
    const daysSince = now.diff(winterSolstice, 'days');
    return daysSince >= 0 && daysSince <= 27;
};

const buildReminderMessage = (
    mode: 'normal' | 'summer' | 'winter' | 'resend', 
    solarTermMsg: string | null, 
    leaderMsg: string,
    dailyWisdom: string
): string => {
    let msg = '';
    
    if (mode === 'summer') {
        msg = `☀️ 夏練三伏進行中！\n\n連續 27 天，養陽固本；不求暴增，只求日進。\n今晚別忘了完成打卡，穩穩累積你的功力！\n\n${leaderMsg}`;
    } else if (mode === 'winter') {
        msg = `❄️ 冬練三九進行中！\n\n冬藏養精，重在恆心。今晚一起穩定練習，\n記得在打卡備註寫上「龜壽功」參與挑戰。\n\n${leaderMsg}`;
    } else if (mode === 'resend') {
        msg = `📣 補發提醒：還沒打卡的同學，現在就來完成！\n\n每天一點點，身心更穩定。\n今天完成，就能守住你的習慣與連勝。`;
    } else {
        if (solarTermMsg) {
            msg = `🌿 ${solarTermMsg}\n\n順時養生，順勢練功。今天也別忘了完成打卡喔！\n\n${leaderMsg}`;
        } else {
            msg = `🌙 晚安！氣功時間到了！\n\n${dailyWisdom}\n\n大家今天練習了嗎？記得完成打卡，守住你的節奏！\n\n${leaderMsg}`;
        }
    }

    if (CHECKIN_SHORTCUT_URL) {
        msg += `\n\n👉 一鍵前往打卡：\n${CHECKIN_SHORTCUT_URL}`;
    }

    return msg;
};

export const sendDailyReminder = async (modeOverride?: 'resend') => {
    try {
        const { rows: groups } = await db.query("SELECT group_id FROM active_groups");
        const groupIds = groups.map(r => r.group_id);

        if (groupIds.length === 0) {
            console.log('No active groups found. Cannot send reminder.');
            return;
        }

        // Generate Solar Term (節氣) Info
        const today = new Date();
        const lunar = Lunar.fromDate(today);
        let solarTermMsg: string | null = null;
        
        const currentJieQi = lunar.getJieQi();
        // If today is exactly the day of a Solar Term
        if (currentJieQi) {
            const guide = getSolarTermGuide(currentJieQi);
            if (guide) {
                solarTermMsg = `今日節氣：${currentJieQi}\n\n${guide}`;
            }
        }

        // Daily Wisdom logic
        const nowTz = moment().tz(TIMEZONE);
        const dailyWisdom = getDailyWisdom(nowTz);

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

        const messageText = buildReminderMessage(
            modeOverride || (isSummerChallengePeriod(nowTz) ? 'summer' : isWinterChallengePeriod(nowTz) ? 'winter' : 'normal'),
            solarTermMsg,
            leaderMsg,
            dailyWisdom
        );

        if (!CHECKIN_SHORTCUT_URL) {
            console.warn('[Warning] LIFF check-in URL is not set. Reminder check-in link will not be appended.');
        }

        // Send via pushMessage to each group individually (multicast does not support group IDs)
        let successCount = 0;
        for (const groupId of groupIds) {
            try {
                await client.pushMessage({
                    to: groupId,
                    messages: [{ type: 'text', text: messageText }]
                });
                successCount++;
            } catch (e) {
                console.error(`Failed to send reminder to group ${groupId}:`, e);
            }
        }

        console.log(`Daily reminder sent successfully to ${successCount}/${groupIds.length} groups`);
    } catch (error) {
        console.error('Error sending daily reminder:', error);
    }
};

export const sendManualResendReminder = async () => {
    return sendDailyReminder('resend');
};

export const sendAdHocBroadcast = async (messageText: string, requestedByUserId?: string): Promise<number> => {
    try {
        console.log(`[AdHoc Broadcast] Started. Requested by: ${requestedByUserId || 'Unknown'}, Time: ${moment().tz(TIMEZONE).format()}`);
        const { rows: groups } = await db.query("SELECT group_id FROM active_groups");
        const groupIds = groups.map(r => r.group_id);

        console.log(`[AdHoc Broadcast] Found ${groupIds.length} active groups.`);

        if (groupIds.length === 0) {
            console.log('[AdHoc Broadcast] No active groups found. Cannot send broadcast.');
            return 0;
        }

        let successCount = 0;
        for (const groupId of groupIds) {
            try {
                await client.pushMessage({
                    to: groupId,
                    messages: [{ type: 'text', text: messageText }]
                });
                successCount++;
            } catch (e) {
                console.error(`[AdHoc Broadcast] Failed to send to group ${groupId}:`, e);
            }
        }

        console.log(`[AdHoc Broadcast] Finished successfully to ${successCount}/${groupIds.length} groups`);
        return successCount;
    } catch (error) {
        console.error('[AdHoc Broadcast] Error sending ad-hoc broadcast:', error);
        return 0;
    }
};
