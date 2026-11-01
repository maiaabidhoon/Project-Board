# Changes in this version

## Fixes
- **Security:** removed a hardcoded MongoDB Atlas username/password from `server/src/config/env.js`, and the DB error message no longer prints passwords. Set `MONGODB_URI` in `server/.env`.
- **Rate limit:** the global API limit (1000 requests / 15 min / IP) was easy to exhaust with polling when several people share one IP, and it replied with plain text so the app showed "Something went wrong". It is now much higher and replies with a readable JSON message.
- **Socket/CORS:** `CLIENT_ORIGIN` accepts several comma-separated origins; in development any localhost / 127.0.0.1 port is accepted (Vite moves to :5174 when :5173 is busy). Optional `VITE_API_URL` / `VITE_SOCKET_URL` for split deployments.
- **AI assistant:** no longer a dead end without an OpenAI key. Built-in "basic mode" answers from your data; also the automatic fallback when OpenAI is down, out of credit, or the key is wrong.
- **Overdue bug:** reports counted a task as overdue for the whole day it was due; reminders used UTC instead of TIMEZONE. Both now use the configured timezone.

## Features
- **Live updates:** tasks, comments, projects, meetings, notifications, rewards and the people list now update instantly for everyone through the existing socket (`sync` event). Polling is only a slow safety net while connected.

## Update: assistant limit + OTP attendance
- **AI Assistant:** removed the cap of 20 messages (10 chats). The assistant's own answers were also longer than the 2000-character limit applied to every message, which made later questions fail; fixed.
- **Attendance by OTP:** new read-only "Project Board OTP" chat for everyone; the admin sends a daily 6-digit OTP there, everyone enters it to mark attendance once per day. New Attendance page with today's status, who is present (managers/admins), and monthly summaries. New files: `server/src/routes/attendance.js`, `models/Attendance*.js`, `utils/attendance.js`, `client/src/features/Attendance.jsx`, `features/attendance/Otp.jsx`.

## Update: Habibi, voice, admin dashboard, rewards, more features
- AI assistant renamed **Habibi** (prompt, basic mode, UI) with hands-free **voice chat**, dictation and read-aloud, English/Hindi.
- **Admin dashboard** (`/api/admin/dashboard`, `features/admin/Dashboard.jsx`) with SVG charts, and **reward management** (editable point values, manual adjust, reset, change log). Admin page now has Dashboard / Team / Rewards tabs.
- **Announcements**, **Calendar**, **attendance CSV export**.
- New server files: `routes/announcements.js`, `models/{Setting,RewardAdjustment,Announcement}.js`, `utils/rewardRules.js`.

## Update: accurate online/offline status in chat
- **Stale "Online" fixed:** when your own connection dropped (network loss, server restart), the app kept showing everyone as online. It now clears the list and shows "Connecting…" instead of guessing.
- **No false "Offline":** before the online list arrives, the header is blank instead of saying "Offline".
- **Instant offline detection:** the app reacts to the browser's online/offline events at once and reconnects when the network or tab comes back. The banner says "You're offline" when there is no internet.
- **Last seen:** offline people show "Offline · last seen 5 minutes ago" (new `lastSeenAt` field on users).
- **Faster server detection:** dead connections (lost signal, sleeping laptop) are noticed in about 18 seconds instead of 45 (`pingInterval`/`pingTimeout` in `server/src/socket.js`).
