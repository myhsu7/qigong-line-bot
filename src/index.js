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
const express_1 = __importDefault(require("express"));
const line = __importStar(require("@line/bot-sdk"));
const dotenv = __importStar(require("dotenv"));
const node_cron_1 = __importDefault(require("node-cron"));
const bot_1 = require("./bot");
const cron_1 = require("./cron");
dotenv.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
const config = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
    channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};
app.post('/webhook', line.middleware(config), (req, res) => {
    Promise
        .all(req.body.events.map(bot_1.handleEvent))
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
node_cron_1.default.schedule('0 20 * * *', () => {
    console.log('Running daily reminder cron job...');
    (0, cron_1.sendDailyReminder)();
}, {
    scheduled: true,
    timezone: "Asia/Taipei"
});
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Cron job scheduled for 20:00 Asia/Taipei`);
});
//# sourceMappingURL=index.js.map