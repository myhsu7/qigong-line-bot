# Qigong LINE Bot

A LINE chatbot for tracking daily Qigong practice, maintaining streaks, and displaying leaderboards. It supports 1-on-1 interactions via Rich Menu and sends a daily motivational reminder (including Solar Term info and current leaders) to a designated group chat.

## Features

- **1-on-1 Check-ins:** Users can tap "✅ Check-In" to log their daily practice. The bot maintains daily streaks and total practice days.
- **Leaderboards:** Users can view the top 10 longest streaks and total check-in days by tapping "🏆 Leaderboard".
- **Personal Stats:** Users can view their own stats by tapping "📊 My Stats".
- **Daily Group Reminder:** At 8:00 PM (Asia/Taipei), the bot sends a message to the group chat with the current/next Solar Term (節氣), a motivational quote, and a random highlight of current streak leaders.

## Prerequisites

- Node.js (v18+)
- Docker & Docker Compose (for the database)
- Tailscale (for secure webhook routing to localhost)
- LINE Developer Account (Messaging API Channel)

## Installation Guide (Ubuntu Server)

### 1. Clone the repository

```bash
git clone <your-github-repo-url> qigong-line-bot
cd qigong-line-bot
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Database Setup

We use Docker to manage the PostgreSQL database. Ensure you have Docker and Docker Compose installed.

```bash
# Start the PostgreSQL database in the background
docker compose up -d db
```
This will automatically create the `qigong_bot` database and run the `schema.sql` initialization script on the first startup.

### 4. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Edit the `.env` file and fill in your details:

```ini
PORT=3000
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token
LINE_CHANNEL_SECRET=your_channel_secret
DATABASE_URL=postgres://qigong_user:qigong_password@localhost:5432/qigong_bot
ADMIN_USER_ID=your_line_user_id
LINE_BOT_SHORTCUT_URL=https://line.me/R/oaMessage/%40your_oa_id/?%E2%9C%85%20Check-In
LIFF_ID=your_liff_id
LINE_LIFF_CHECKIN_URL=https://liff.line.me/your_liff_id
LIFF_ID_CHECKIN=your_checkin_liff_id
LIFF_ID_LEADERBOARD=your_leaderboard_liff_id
LIFF_ID_HISTORY=your_history_liff_id
LIFF_ID_METHOD_ANALYSIS=your_method_analysis_liff_id
LIFF_ID_ACHIEVEMENTS=your_achievements_liff_id
LIFF_ID_REMINDER=your_reminder_liff_id
ADMIN_DASH_USER=admin
ADMIN_DASH_PASS=your_strong_password
ADMIN_ALLOWED_IP_PREFIX=100.
```
*(If you are using the provided Docker setup, the default DB credentials will work immediately).*
*(For `ADMIN_USER_ID`, this is your personal LINE user ID, needed to execute `!admin` commands).*
*(For `LINE_BOT_SHORTCUT_URL`, this is the deep link used in group reminders to open the 1-on-1 chat with the bot and prefill `✅ Check-In`, so LIFF check-in runs in DM context instead of posting summaries back to the group).*
*(For `LIFF_ID`, this is the legacy shared LIFF app id. It can still be used as a fallback, but the recommended setup now uses dedicated LIFF apps per feature.)*
*(For `LINE_LIFF_CHECKIN_URL`, this is the legacy shared LIFF launch URL. With dedicated LIFF apps configured, the bot will prefer `LIFF_ID_CHECKIN`, `LIFF_ID_LEADERBOARD`, `LIFF_ID_HISTORY`, `LIFF_ID_METHOD_ANALYSIS`, `LIFF_ID_ACHIEVEMENTS`, and `LIFF_ID_REMINDER`.)*

⚠️ **Important:** `ADMIN_USER_ID` is **NOT** your regular LINE ID (the one you give friends to add you). It is your Developer User ID, which always starts with the letter `U` (e.g., `U1234567890abcdef...`). You can find this ID in the [LINE Developer Console](https://developers.line.biz/console/) by navigating to your Provider -> your Messaging API Channel -> clicking the **Basic settings** tab and scrolling all the way to the bottom to "**Your user ID**".

### 5. Setup Tailscale Funnel (Webhook)

To allow LINE to communicate with your local server, expose port 3000 using Tailscale Funnel:

```bash
tailscale funnel 3000
```
This will output a public HTTPS URL (e.g., `https://your-node-name.tailscale.net`). 

1. Go to your LINE Developer Console.
2. Under your Messaging API channel settings, find the **Webhook URL** setting.
3. Enter your Tailscale URL followed by `/line/webhook` (e.g., `https://your-node-name.tailscale.net/line/webhook`).
4. Click **Verify** to ensure the connection works (make sure the app is running first, see step 6).
5. Enable "Use webhook".

### 6. Start the Application

To run the bot in development mode:

```bash
npm run dev
```

To build and run in production:

```bash
npm run build
npm start
```

## Post-Installation Setup

1. **Invite to Group:** Invite the bot to your Qigong LINE groups. The bot will automatically capture the `group_id` when it joins and save it to the database so it knows where to send the 8:00 PM daily reminders.
    - If you miss the join event, you can type `!admin register_group` in the group to manually register it.
2. **Setup Rich Menu:** Use the LINE Official Account Manager web dashboard to create your Rich Menu.
    1. Go to the [LINE Official Account Manager](https://manager.line.biz/) and log in.
    2. Select your Qigong bot's Official Account.
    3. On the left sidebar under the **Home** tab, find **Chat screen** and click on **Rich menus**.
    4. Click the **Create a rich menu** button.
    5. **Display Settings:**
       - **Title:** Enter a name (e.g., "Qigong Main Menu").
       - **Active Period:** Set the start date to today and the end date far into the future (e.g., year 2030).
       - **Menu bar text:** Enter "Menu" or "選單".
       - **Default behavior:** Select "Display".
    6. **Content & Action Settings:**
       - **Select a template:** Choose a template with 6 distinct buttons/areas.
       - **Upload Background Image:** Upload a matching background image (check LINE's dimension requirements).
       - **Action A (Check-In):** Set Action type to **URI** and point to the official LIFF URL for Check-In.
       - **Action B (Leaderboard):** Set Action type to **URI** and point to the official LIFF URL for Leaderboard.
       - **Action C (History):** Set Action type to **URI** and point to the official LIFF URL for History.
       - **Action D (Method Analysis):** Set Action type to **URI** and point to the official LIFF URL for personal Method Analysis.
       - **Action E (Achievements):** Set Action type to **URI** and point to the official LIFF URL for Achievements.
       - **Action F (Reminder):** Set Action type to **URI** and point to the official LIFF URL for Reminder info/settings.
     7. Click **Save**. The menu will now appear for anyone who adds your bot.

## 🏆 Leaderboards

The bot tracks performance across different time windows to keep the community engaged. You can view these leaderboards by typing the following commands (or adding them to your Rich Menu):

- `🏆 Leaderboard`: The **All-Time** leaderboard (shows lifetime top streaks and total days).
- `🏆 Weekly Leaderboard`: The **Weekly** leaderboard (resets every Monday at 00:00 Asia/Taipei).
- `🏆 Monthly Leaderboard`: The **Monthly** leaderboard (resets on the 1st of every month).
- `🏆 Quarterly Leaderboard`: The **Quarterly** leaderboard (resets at the start of Q1, Q2, Q3, Q4).

*Note: Each period leaderboard displays both the top 10 "Total check-in days" and the top 10 "Longest streak" achieved strictly within that time window.*

## 🎮 Cultivation Levels & Badges (Gamification)

To encourage daily Qigong practice, the bot features a built-in level and badge system.

### Cultivation Levels (境界)
Your level increases based on your **total** check-in days:
- **練氣 (Level 1):** 0 - 29 days
- **築基 (Level 2):** 30 - 89 days
- **結丹 (Level 3):** 90 - 199 days
- **化境 (Level 4):** 200+ days

### Badges (榮譽勳章)
Badges are displayed in your "Trophy Case" when you check your stats. Some badges can be earned multiple times (e.g., once per year).

#### Streak Badges (連續打卡)
- 🥉 **入門:** 3 consecutive days
- 🥈 **小成:** 7 consecutive days
- 🥇 **結丹:** 21 consecutive days
- 💎 **百日築基:** 100 consecutive days

#### Total Days Badges (總計打卡)
- 🌱 **初芽:** 10 total days
- 🌳 **大樹:** 100 total days

#### Time-Based Badges (特殊時辰)
- 🌅 **晨露:** 5 consecutive days checking in between 05:00 - 07:00
- 🦉 **夜靜:** 5 consecutive days checking in between 21:00 - 23:00

#### Seasonal Challenges (歲時節氣)
- ☀️ **夏練三伏:** Earned by checking in for 27 consecutive days exactly after the Summer Solstice (夏至).
- ❄️ **冬練三九:** Earned by checking in for 27 consecutive days exactly after the Winter Solstice (冬至) **and** including the keyword "龜壽功" in your practice note.

## Admin Commands

If you have configured `ADMIN_USER_ID` in your `.env` file, you can type these commands in any chat (1-on-1 or group) with the bot:
- `!admin register_group`: Register the current group for daily broadcasts.
- `!admin resend-reminder`: Manually trigger the 8:00 PM daily reminder broadcast.
- `!admin broadcast [message]`: Send an ad-hoc custom message to all registered active groups.

## LINE LIFF Pages

The LINE bot now supports multiple LIFF pages for the 6-button Rich Menu design.

### Recommended 6-button layout

First row:
- Check-In
- Leaderboard
- History

Second row:
- Method Analysis
- Achievements
- Reminder

### LIFF routes

- `GET /line/liff/checkin`
- `GET /line/liff/leaderboard`
- `GET /line/liff/history`
- `GET /line/liff/method-analysis`
- `GET /line/liff/achievements`
- `GET /line/liff/reminder`

### LIFF APIs

- `GET /line/api/liff/practice-methods`
- `GET /line/api/liff/checkin/today`
- `POST /line/api/liff/checkin`
- `GET /line/api/liff/leaderboard`
- `GET /line/api/liff/history`
- `GET /line/api/liff/method-analysis`
- `GET /line/api/liff/achievements`

### User flow

1. User taps `✅ Check-In` in the 1-on-1 chat.
2. Bot replies with a LIFF link (`LINE_LIFF_CHECKIN_URL`).
3. User opens the LIFF page and:
   - selects one or more practice methods
   - optionally fills reflection note
   - optionally fills body feeling note
4. Submit saves today's check-in.
5. If the user already checked in today, the LIFF page prefills today's content and allows overwrite update without increasing total days twice.

### Database migration

Run this migration to enable structured check-in:

```bash
docker exec -i qigong_db psql -U qigong_user -d qigong_bot < migrations/003_line_liff_structured_checkin.sql
```

This migration adds:

- `practice_methods`
- `checkin_method_selections`
- structured fields on `checkin_logs`

### LIFF setup in LINE Developers Console

Create dedicated LIFF apps for each user-facing page to avoid the old "open check-in then redirect" flicker.

Recommended mapping:

| LIFF ID env | Endpoint URL |
|---|---|
| `LIFF_ID_CHECKIN` | `/line/liff/checkin` |
| `LIFF_ID_LEADERBOARD` | `/line/liff/leaderboard` |
| `LIFF_ID_HISTORY` | `/line/liff/history` |
| `LIFF_ID_METHOD_ANALYSIS` | `/line/liff/method-analysis` |
| `LIFF_ID_ACHIEVEMENTS` | `/line/liff/achievements` |
| `LIFF_ID_REMINDER` | `/line/liff/reminder` |

Each LIFF app should use its own official launch URL:

```text
https://liff.line.me/{LIFF_ID_CHECKIN}
https://liff.line.me/{LIFF_ID_LEADERBOARD}
https://liff.line.me/{LIFF_ID_HISTORY}
https://liff.line.me/{LIFF_ID_METHOD_ANALYSIS}
https://liff.line.me/{LIFF_ID_ACHIEVEMENTS}
https://liff.line.me/{LIFF_ID_REMINDER}
```

If only the legacy shared `LIFF_ID` is configured, the bot will fall back to the old shared-entry behavior for compatibility.

### Compatibility

- New structured check-ins are stored in `checkin_method_selections`.
- Existing text-only history is preserved.
- Method analysis now prefers structured selections and falls back to note text matching for older records.

## 📈 Admin Dashboard (Web)

A secure, read-only web dashboard is available to view check-in trends and community leaderboards without sending messages to the LINE group.

1. **Access**: Navigate to `http://<your-server-ip>:3000/line/admin-dashboard`.
2. **Security**: 
   - By default, the dashboard **blocks all public traffic** and only allows connections from Tailscale IPs (`100.*`). You can configure this via the `ADMIN_ALLOWED_IP_PREFIX` environment variable.
   - It requires Basic Auth credentials configured in `.env` (`ADMIN_DASH_USER` and `ADMIN_DASH_PASS`).
3. **Features**:
   - Filter by Week, Month, Quarter, and Year.
   - View Daily Check-in Trends (Chart.js).
   - View Top 10 Total Check-ins and Top 10 Longest Streaks.
   - **Method Analysis:** View community-wide method distributions (Pie chart) and search individual users to see their personal method composition ratios over the last 30 and 90 days.
   - Multilingual support (zh-TW and English, determined by browser language or `?lang=` query param).

## Tech Stack
- TypeScript / Node.js
- Express
- PostgreSQL
- @line/bot-sdk
- node-cron (for daily reminders)
- lunar-javascript (for Solar Terms)
- moment-timezone (for Asia/Taipei timezone handling)
