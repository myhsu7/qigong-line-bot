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
```
*(If you are using the provided Docker setup, these default credentials will work immediately).*

### 5. Setup Tailscale Funnel (Webhook)

To allow LINE to communicate with your local server, expose port 3000 using Tailscale Funnel:

```bash
tailscale funnel 3000
```
This will output a public HTTPS URL (e.g., `https://your-node-name.tailscale.net`). 

1. Go to your LINE Developer Console.
2. Under your Messaging API channel settings, find the **Webhook URL** setting.
3. Enter your Tailscale URL followed by `/webhook` (e.g., `https://your-node-name.tailscale.net/webhook`).
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

1. **Invite to Group:** Invite the bot to your main Qigong LINE group. The bot will automatically capture the `group_id` when it joins and save it to the database so it knows where to send the 8:00 PM daily reminders.
2. **Setup Rich Menu:** Use the LINE Official Account Manager web dashboard to create a Rich Menu with the buttons "✅ Check-In", "🏆 Leaderboard", and "📊 My Stats".

## Tech Stack
- TypeScript / Node.js
- Express
- PostgreSQL
- @line/bot-sdk
- node-cron (for daily reminders)
- lunar-javascript (for Solar Terms)
- moment-timezone (for Asia/Taipei timezone handling)
