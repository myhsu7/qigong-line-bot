"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleEvent = void 0;
const line = __importStar(require("@line/bot-sdk"));
const db_1 = require("./db");
const moment_timezone_1 = __importDefault(require("moment-timezone"));
const TIMEZONE = 'Asia/Taipei';
const lineConfig = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
    channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};
const client = new line.messagingApi.MessagingApiClient(lineConfig);
// Simple in-memory state for user sessions
const userStates = new Map();
const handleEvent = async (event) => {
    // 1. Capture Group ID if the bot is invited to a group
    if (event.type === 'join' && event.source.type === 'group') {
        const groupId = event.source.groupId;
        await db_1.db.query("INSERT INTO config (key, value) VALUES ('group_id', $1) ON CONFLICT (key) DO UPDATE SET value = $1", [groupId]);
        return client.replyMessage({
            replyToken: event.replyToken,
            messages: [{ type: 'text', text: '大家好！我已經準備好為大家記錄每天的氣功練習了。請記得加我為好友，在私訊中進行每日打卡喔！' }]
        });
    }
    // 2. We only care about text messages from users
    if (event.type !== 'message' || event.message.type !== 'text' || event.source.type !== 'user') {
        return null;
    }
    const userId = event.source.userId;
    const text = event.message.text.trim();
    const replyToken = event.replyToken;
    // Retrieve user profile if not exist in DB
    const profile = await client.getProfile(userId);
    await db_1.db.query(`INSERT INTO users (line_user_id, display_name) VALUES ($1, $2) ON CONFLICT (line_user_id) DO UPDATE SET display_name = $2`, [userId, profile.displayName]);
    // Check state
    const currentState = userStates.get(userId);
    if (text === '✅ Check-In') {
        userStates.set(userId, 'WAITING_FOR_NOTE');
        return client.replyMessage({
            replyToken,
            messages: [{ type: 'text', text: '太棒了！你今天練習了什麼氣功呢？' }]
        });
    }
    if (text === '🏆 Leaderboard') {
        const topStreaks = await db_1.db.query('SELECT display_name, longest_streak FROM users WHERE longest_streak > 0 ORDER BY longest_streak DESC LIMIT 10');
        const topTotals = await db_1.db.query('SELECT display_name, total_checkins FROM users WHERE total_checkins > 0 ORDER BY total_checkins DESC LIMIT 10');
        let msg = '🏆 排行榜 🏆\n\n';
        msg += '🔥 最高連續打卡：\n';
        topStreaks.rows.forEach((r, i) => msg += `${i + 1}. ${r.display_name} (${r.longest_streak}天)\n`);
        msg += '\n⭐ 總打卡天數：\n';
        topTotals.rows.forEach((r, i) => msg += `${i + 1}. ${r.display_name} (${r.total_checkins}天)\n`);
        if (topStreaks.rows.length === 0)
            msg = '目前還沒有人打卡喔，快來搶頭香！';
        return client.replyMessage({
            replyToken,
            messages: [{ type: 'text', text: msg }]
        });
    }
    if (text === '📊 My Stats') {
        const userStats = await db_1.db.query('SELECT current_streak, longest_streak, total_checkins FROM users WHERE line_user_id = $1', [userId]);
        if (userStats.rows.length > 0) {
            const row = userStats.rows[0];
            return client.replyMessage({
                replyToken,
                messages: [{ type: 'text', text: `📊 你的練習數據：\n\n連續打卡：${row.current_streak} 天\n最高連打：${row.longest_streak} 天\n總計打卡：${row.total_checkins} 天\n\n繼續保持！💪` }]
            });
        }
        return null;
    }
    // Handle Note input
    if (currentState === 'WAITING_FOR_NOTE') {
        userStates.delete(userId); // clear state
        const now = (0, moment_timezone_1.default)().tz(TIMEZONE);
        const todayStr = now.format('YYYY-MM-DD');
        const yesterdayStr = now.clone().subtract(1, 'days').format('YYYY-MM-DD');
        // Get user current stats
        const userRes = await db_1.db.query('SELECT current_streak, longest_streak, last_checkin_date FROM users WHERE line_user_id = $1', [userId]);
        const user = userRes.rows[0];
        const lastCheckinDate = user.last_checkin_date ? (0, moment_timezone_1.default)(user.last_checkin_date).tz(TIMEZONE).format('YYYY-MM-DD') : null;
        let newStreak = user.current_streak;
        if (lastCheckinDate === todayStr) {
            return client.replyMessage({
                replyToken,
                messages: [{ type: 'text', text: '你今天已經打過卡囉！我們明天見！(如果有新心得也可以繼續分享)' }]
            });
        }
        else if (lastCheckinDate === yesterdayStr) {
            newStreak += 1;
        }
        else {
            newStreak = 1;
        }
        const newLongestStreak = Math.max(newStreak, user.longest_streak);
        // Update DB
        await db_1.db.query('UPDATE users SET current_streak = $1, longest_streak = $2, total_checkins = total_checkins + 1, last_checkin_date = $3 WHERE line_user_id = $4', [newStreak, newLongestStreak, todayStr, userId]);
        await db_1.db.query('INSERT INTO checkin_logs (line_user_id, note) VALUES ($1, $2)', [userId, text]);
        return client.replyMessage({
            replyToken,
            messages: [{ type: 'text', text: `紀錄成功！你已連續打卡 ${newStreak} 天！🔥\n\n今日練習：${text}` }]
        });
    }
    // Fallback message
    return client.replyMessage({
        replyToken,
        messages: [{ type: 'text', text: '抱歉，我不懂這個指令。請使用下方選單打卡喔！' }]
    });
};
exports.handleEvent = handleEvent;
//# sourceMappingURL=bot.js.map