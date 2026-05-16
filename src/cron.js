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
exports.sendDailyReminder = void 0;
const db_1 = require("./db");
const lunar_javascript_1 = require("lunar-javascript");
const line = __importStar(require("@line/bot-sdk"));
const moment_timezone_1 = __importDefault(require("moment-timezone"));
const TIMEZONE = 'Asia/Taipei';
const lineConfig = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
    channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};
const client = new line.messagingApi.MessagingApiClient(lineConfig);
const sendDailyReminder = async () => {
    try {
        const { rows } = await db_1.db.query("SELECT value FROM config WHERE key = 'group_id'");
        const groupId = rows[0]?.value;
        if (!groupId) {
            console.log('No group_id found in config. Cannot send reminder.');
            return;
        }
        // Generate Solar Term (節氣) Info
        const today = new Date();
        const lunar = lunar_javascript_1.Lunar.fromDate(today);
        let solarTermMsg = '';
        const currentJieQi = lunar.getJieQi();
        const nextJieQi = lunar.getNextJieQi();
        if (currentJieQi) {
            solarTermMsg = `今天是${currentJieQi}！`;
        }
        else {
            const nextJieQiDate = nextJieQi.getSolar().toYmd();
            solarTermMsg = `距離下一個節氣「${nextJieQi.getName()}」還有幾天 (${nextJieQiDate})。`;
        }
        // Leaderboard Highlight (e.g. random top 3 streaks)
        const leaderResult = await db_1.db.query("SELECT display_name, current_streak FROM users WHERE current_streak > 0 ORDER BY RANDOM() LIMIT 3");
        let leaderMsg = '';
        if (leaderResult.rows.length > 0) {
            leaderMsg = '🔥 今日精進榜：\n' + leaderResult.rows.map(r => `• ${r.display_name} - 連續 ${r.current_streak} 天`).join('\n');
        }
        else {
            leaderMsg = '大家快來打卡，開啟你的練功連勝紀錄吧！';
        }
        const messageText = `🌙 晚安！氣功時間到了！\n\n${solarTermMsg}\n\n「練功如春起之苗，不見其增，日有所長。」\n大家今天練習了嗎？記得去 1對1 聊天室打卡喔！\n\n${leaderMsg}`;
        await client.pushMessage({
            to: groupId,
            messages: [{ type: 'text', text: messageText }]
        });
        console.log(`Daily reminder sent successfully to ${groupId}`);
    }
    catch (error) {
        console.error('Error sending daily reminder:', error);
    }
};
exports.sendDailyReminder = sendDailyReminder;
//# sourceMappingURL=cron.js.map