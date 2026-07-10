import { db } from './db';
import { Lunar } from 'lunar-javascript';
import { messagingApi } from '@line/bot-sdk';
import moment from 'moment-timezone';

import { getDailyWisdom } from './content/wisdom';
import { getSolarTermGuide } from './content/solarTerms';
import { getSanFuPeriod, isDateInSanFuPeriod } from './utils/sanfu';

const TIMEZONE = 'Asia/Taipei';
const CHECKIN_SHORTCUT_URL = process.env.LINE_BOT_SHORTCUT_URL || '';

const lineConfig = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
    channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};

const client = new messagingApi.MessagingApiClient(lineConfig);

const BADGE_SPOTLIGHT_ORDER = [
    'streak_3', 'streak_7', 'streak_21', 'streak_100',
    'total_10', 'total_100',
    'time_morning', 'time_night',
    'seasonal_summer_27', 'seasonal_winter_27',
    'combo_dayan', 'combo_wuqinxi', 'combo_huichun', 'combo_guishou', 'combo_zhengyang', 'combo_jinggong',
    'method_dayan_7', 'method_dayan_30', 'method_dayan_100',
    'method_wuqinxi_7', 'method_wuqinxi_30', 'method_wuqinxi_100',
    'method_huichun_7', 'method_huichun_30', 'method_huichun_100',
    'method_guishou_7', 'method_guishou_30', 'method_guishou_100',
    'method_zhengyang_7', 'method_zhengyang_30', 'method_zhengyang_100',
    'method_huanghai_7', 'method_huanghai_30', 'method_huanghai_100',
    'method_lotus_7', 'method_lotus_30', 'method_lotus_100',
    'method_heqi_7', 'method_heqi_30', 'method_heqi_100',
    'method_sanwo_7', 'method_sanwo_30', 'method_sanwo_100',
    'method_liuyin_7', 'method_liuyin_30', 'method_liuyin_100',
    'method_jinggong_7', 'method_jinggong_30', 'method_jinggong_100'
] as const;

// Helper to get Solar Term exact date using Lunar.fromDate mapping
const getJieQiDateStr = (year: number, jieQiName: string): string | null => {
    const lunar = Lunar.fromDate(new Date(year, 6, 1));
    const jieQi = lunar.getJieQiTable()[jieQiName];
    return jieQi ? jieQi.toYmd() : null;
};

const getGreeting = (now: moment.Moment) => {
    const hour = now.hour();
    if (hour >= 5 && hour < 11) return '☀️ 早安！';
    if (hour >= 11 && hour < 17) return '🌤 午安！';
    return '🌙 晚安！';
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
    greeting: string,
    solarTermMsg: string | null, 
    badgeSpotlightMsg: string,
    leaderMsg: string,
    dailyWisdom: string,
    sanFuTotalDays: number | null
): string => {
    let msg = '';
    
    if (mode === 'summer') {
        const totalDaysText = sanFuTotalDays ? `今年三伏期間共 ${sanFuTotalDays} 天` : '三伏期間進行中';
        msg = `${greeting} 夏練三伏進行中！\n\n${totalDaysText}，養陽固本；不求暴增，只求日進。\n今晚別忘了完成打卡，穩穩累積你的功力！\n\n${badgeSpotlightMsg}\n\n${leaderMsg}`;
    } else if (mode === 'winter') {
        msg = `${greeting} 冬練三九進行中！\n\n冬藏養精，重在恆心。今晚一起穩定練習，\n記得在打卡備註寫上「龜壽功」參與挑戰。\n\n${badgeSpotlightMsg}\n\n${leaderMsg}`;
    } else if (mode === 'resend') {
        msg = `📣 補發提醒：還沒打卡的同學，現在就來完成！\n\n每天一點點，身心更穩定。\n今天完成，就能守住你的習慣與連勝。`;
    } else {
        if (solarTermMsg) {
            msg = `${greeting} ${solarTermMsg}\n\n順時養生，順勢練功。今天也別忘了完成打卡喔！\n\n${badgeSpotlightMsg}\n\n${leaderMsg}`;
        } else {
            msg = `${greeting} 氣功時間到了！\n\n${dailyWisdom}\n\n大家今天練習了嗎？記得完成打卡，守住你的節奏！\n\n${badgeSpotlightMsg}\n\n${leaderMsg}`;
        }
    }

    if (CHECKIN_SHORTCUT_URL) {
        msg += `\n\n👉 一鍵前往打卡：\n${CHECKIN_SHORTCUT_URL}`;
    }

    return msg;
};

const getLeaderMessage = async () => {
    const leaderResult = await db.query(
        'SELECT display_name, current_streak FROM users WHERE current_streak > 0 ORDER BY RANDOM() LIMIT 3'
    );

    if (leaderResult.rows.length > 0) {
        return '🔥 每日精進榜：\n' + leaderResult.rows.map((r) => `• ${r.display_name} - 連續 ${r.current_streak} 天`).join('\n');
    }

    return '🔥 每日精進榜：\n大家快來打卡，開啟你的練功連勝紀錄吧！';
};

const getBadgeSpotlightMessage = async (now: moment.Moment) => {
    const { rows } = await db.query(
        `SELECT id, name, emoji, description
         FROM badges`
    );

    if (rows.length === 0) {
        return '🏅 本期挑戰成就\n暫無成就資料';
    }

    const orderMap = new Map(BADGE_SPOTLIGHT_ORDER.map((id, index) => [id, index]));
    const sortedRows = [...rows].sort((a, b) => {
        const aIndex = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const bIndex = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        if (aIndex !== bIndex) return aIndex - bIndex;
        return String(a.id).localeCompare(String(b.id));
    });

    const badgeIndex = Math.floor((now.dayOfYear() - 1) / 3) % sortedRows.length;
    const badge = sortedRows[badgeIndex];
    const emoji = badge.emoji || '🏅';

    return [
        '🏅 本期挑戰成就',
        `${emoji} ${badge.name}`,
        badge.description,
        '',
        '完成這項挑戰，替你的修練留下一枚勳章。'
    ].join('\n');
};

export const createReminderText = async (modeOverride?: 'resend') => {
    const today = new Date();
    const lunar = Lunar.fromDate(today);
    let solarTermMsg: string | null = null;

    const currentJieQi = lunar.getJieQi();
    if (currentJieQi) {
        const guide = getSolarTermGuide(currentJieQi);
        if (guide) {
            solarTermMsg = `今日節氣：${currentJieQi}\n\n${guide}`;
        }
    }

    const nowTz = moment().tz(TIMEZONE);
    const sanFuPeriod = getSanFuPeriod(nowTz.year());
    const greeting = getGreeting(nowTz);
    const dailyWisdom = getDailyWisdom(nowTz);
    const [leaderMsg, badgeSpotlightMsg] = await Promise.all([
        getLeaderMessage(),
        getBadgeSpotlightMessage(nowTz)
    ]);

    return buildReminderMessage(
        modeOverride || (isDateInSanFuPeriod(nowTz) ? 'summer' : isWinterChallengePeriod(nowTz) ? 'winter' : 'normal'),
        greeting,
        solarTermMsg,
        badgeSpotlightMsg,
        leaderMsg,
        dailyWisdom,
        sanFuPeriod?.totalDays || null
    );
};

export const sendDailyReminder = async (modeOverride?: 'resend') => {
    try {
        const { rows: groups } = await db.query("SELECT group_id FROM active_groups");
        const groupIds = groups.map(r => r.group_id);

        if (groupIds.length === 0) {
            console.log('No active groups found. Cannot send reminder.');
            return { successCount: 0, totalCount: 0, groupIds: [] as string[] };
        }

        const messageText = await createReminderText(modeOverride);

        if (!CHECKIN_SHORTCUT_URL) {
            console.warn('[Warning] LINE_BOT_SHORTCUT_URL is not set. Reminder check-in link will not be appended.');
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
        return { successCount, totalCount: groupIds.length, groupIds };
    } catch (error) {
        console.error('Error sending daily reminder:', error);
        return { successCount: 0, totalCount: 0, groupIds: [] as string[] };
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
