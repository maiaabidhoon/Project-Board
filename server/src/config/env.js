import 'dotenv/config'

const isProd = process.env.NODE_ENV === 'production'

// CLIENT_ORIGIN may list several origins, separated by commas (e.g. your site and a staging copy)
const clientOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean)

const LOCAL_DEV = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

/**
 * Is this browser origin allowed to call the API / open a socket?
 * Requests with no Origin header (same-origin, curl, server-to-server) are always fine.
 * In development any localhost / 127.0.0.1 port is accepted, because Vite quietly moves to :5174 when :5173 is busy
 * and people open the app as either "localhost" or "127.0.0.1".
 */
export const isAllowedOrigin = (origin) =>
  !origin || clientOrigins.includes(origin.replace(/\/$/, '')) || (!isProd && LOCAL_DEV.test(origin))

// Shared by Express (cors package) and Socket.IO
export const corsOrigin = (origin, callback) => callback(null, isAllowedOrigin(origin))

export const env = {
  isProd,
  port: Number(process.env.PORT) || 4000,
  // Never put a real connection string (with a password) in source code. Set MONGODB_URI in server/.env instead.
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/projectboard',
  jwtSecret: process.env.JWT_SECRET || (isProd ? '' : 'dev-only-secret-change-me'),
  timezone: process.env.TIMEZONE || 'Asia/Kolkata', // decides what counts as "a day" for streaks and overdue checks
  jwtExpires: process.env.JWT_EXPIRES || '8h',
  openaiKey: process.env.OPENAI_API_KEY || '', // AI assistant; without a key it falls back to built-in "basic mode"
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  clientOrigin: clientOrigins[0],
  clientOrigins,
}

if (!env.jwtSecret) throw new Error('JWT_SECRET must be set in production')
