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
