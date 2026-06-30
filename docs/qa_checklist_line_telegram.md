# LINE + Telegram 打卡小幫手 QA 驗證清單

這份清單用來在正式擴大推廣前，逐項驗證 LINE 版與 Telegram 版是否運作正常。

---

## 一、測試前準備

### 1. 確認服務已啟動

- LINE bot server 已啟動
- Telegram bot server 已啟動
- PostgreSQL 已啟動
- Caddy / reverse proxy 已啟動
- Tailscale Funnel 已啟動

### 2. 確認平台入口

- LINE Official Account 可正常加好友
- Telegram bot 可正常搜尋或點連結打開

### 3. 確認測試帳號

至少準備：

- 管理者帳號 1 個
- 一般測試使用者 2 至 3 個
- 最好分別在 LINE 與 Telegram 都有測試帳號

---

## 二、LINE 版 QA

## A. 基本互動

- [ ] 可正常加 LINE bot 為好友
- [ ] Rich Menu 正常顯示
- [ ] `✅ Check-In` 按鈕可正常使用
- [ ] `📊 My Stats` 可正常回覆
- [ ] `🏆 Leaderboard` 可正常回覆
- [ ] `🏆 Weekly Leaderboard` 可正常回覆
- [ ] `🏆 Monthly Leaderboard` 可正常回覆
- [ ] `🏆 Quarterly Leaderboard` 可正常回覆

## B. 打卡流程

- [ ] 第一次打卡成功
- [ ] 同一天第二次打卡不會重複增加 total / streak
- [ ] 不同天打卡會正常累加 streak
- [ ] 打卡備註有正確寫入資料庫
- [ ] 功法名稱在 `method-analysis` 可被正確辨識（若為 alias）

## C. Reminder 與群組行為

- [ ] 晚上 8 點提醒正常送出到群組
- [ ] reminder 內 deep link 可打開 1 對 1 聊天室
- [ ] 非節氣日會顯示每日鼓勵小語
- [ ] 節氣日會顯示正確節氣指引
- [ ] `/admin resend-reminder` 可手動補發
- [ ] `/admin broadcast ...` 可正常廣播

## D. 成就與統計

- [ ] 3 日 / 7 日 / 21 日 / 100 日 badge 可正常解鎖
- [ ] total 10 / 100 badge 可正常解鎖
- [ ] `📊 My Stats` 顯示當前境界與 badges
- [ ] seasonal badge 不會同年重複解鎖
- [ ] seasonal badge 可跨年再取得

## E. Admin Dashboard

- [ ] `/line/admin-dashboard` 可正常進入
- [ ] 僅 Tailscale 內網可進入
- [ ] Basic Auth 正常
- [ ] Overview 圖表正常
- [ ] Leaderboard 頁面正常
- [ ] Method Analysis 頁面正常
- [ ] Method Analysis 中搜尋學員可正常查詢

---

## 三、Telegram 版 QA

## A. 基本互動

- [ ] `/start` 正常回覆歡迎訊息
- [ ] `/start` 顯示 `✅ 開始打卡` 與 `🏮 開啟成就頁`
- [ ] `/checkin` 正常開啟 Web App
- [ ] `/chickin` alias 也可正常開啟 Web App
- [ ] `/mystats` 正常回覆
- [ ] `/badges` 正常回覆
- [ ] `/achievements` 正常開啟成就頁
- [ ] `/leaderboard`、`/weekly`、`/monthly`、`/quarterly`、`/yearly` 正常
- [ ] `/method30`、`/method90` 正常

## B. Telegram Web App 打卡

- [ ] Web App 可正常載入功法清單
- [ ] 可複選功法
- [ ] 心得欄可送出
- [ ] 身體感受欄可送出
- [ ] 今日未打卡時顯示空白表單
- [ ] 今日已打卡時可正確回填內容
- [ ] 同日再次送出時，會覆蓋更新，不重複累加
- [ ] 成功送出後顯示：功法 + streak + total + 新解鎖勳章

## C. Telegram Reminder

- [ ] `TELEGRAM_REMINDER_ENABLED=true` 時，排程正常運作
- [ ] `TELEGRAM_REMINDER_HOUR=20` 時，20:00 正常送出
- [ ] `/remindtest` 可手動補發
- [ ] 節氣日顯示節氣指引
- [ ] 非節氣日顯示 50 句輪播鼓勵語

## D. Telegram 成就系統

- [ ] 第一日打卡不會亂發 badge
- [ ] 第 3 / 7 / 21 / 100 日正常解鎖
- [ ] total 10 / 100 正常解鎖
- [ ] `/mystats` 顯示境界與 trophy case
- [ ] `/badges` 顯示完整 badge list
- [ ] `/achievements` Web App 顯示進度條與 badge cards

## E. Telegram Admin Dashboard

- [ ] `/telegram/admin` 正常打開
- [ ] `/telegram/admin/leaderboard` 正常打開
- [ ] `/telegram/admin/method-analysis` 正常打開
- [ ] `/telegram/admin` 僅 Tailscale 可進入
- [ ] Basic Auth 正常

---

## 四、資料一致性 QA

- [ ] LINE 打卡資料進入 LINE 專用資料表
- [ ] Telegram 打卡資料進入 Telegram 專用資料表
- [ ] 同日覆蓋更新不重複新增資料列
- [ ] streak 計算正確
- [ ] leaderboard 排名與資料庫吻合
- [ ] method-analysis 比例與資料庫資料吻合

---

## 五、Webhook / 路徑驗證

## LINE

- [ ] LINE Developer Console verify 成功
- [ ] `https://ubuntu1.tailbf9b8d.ts.net/line/webhook` 可正常被代理到 LINE app

## Telegram

- [ ] `getWebhookInfo` 顯示正確 URL
- [ ] `last_error_message` 為空
- [ ] `https://ubuntu1.tailbf9b8d.ts.net/telegram/webhook/<secret>` 不再回 404

---

## 六、建議驗證順序

1. 先測 webhook 與登入入口
2. 再測打卡寫入
3. 再測同日覆蓋更新
4. 再測 streak / leaderboard
5. 再測 badges / achievements
6. 最後測 admin dashboard 與 reminder

---

## 七、驗收標準

可以進入小規模測試的標準：

- [ ] LINE 與 Telegram 都能正常打卡
- [ ] reminders 正常送出
- [ ] 同日覆蓋更新不會破壞統計
- [ ] badges / leaderboard / stats 結果合理
- [ ] admin dashboard 三頁都可用
- [ ] 至少 2 位測試者完整使用一天以上無明顯錯誤
