import 'dotenv/config'

const isProd = process.env.NODE_ENV === 'production'

export const env = {
  isProd,
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/projectboard',
  jwtSecret: process.env.JWT_SECRET || (isProd ? '' : 'dev-only-secret-change-me'),
  timezone: process.env.TIMEZONE || 'Asia/Kolkata', // decides what counts as "a day" for streaks
  jwtExpires: process.env.JWT_EXPIRES || '8h',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
}

if (!env.jwtSecret) throw new Error('JWT_SECRET must be set in production')
