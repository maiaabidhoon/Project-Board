import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'

import { env, corsOrigin } from './config/env.js'
import { authenticate } from './middleware/auth.js'
import { requireRole, can } from './middleware/roles.js'
import { notFound, errorHandler } from './middleware/error.js'
import authRoutes from './routes/auth.js'
import adminRoutes from './routes/admin.js'
import memberRoutes from './routes/members.js'
import projectRoutes from './routes/projects.js'
import taskRoutes from './routes/tasks.js'
import notificationRoutes from './routes/notifications.js'
import rewardRoutes from './routes/rewards.js'
import chatRoutes from './routes/chat.js'
import meetingRoutes from './routes/meetings.js'
import reportRoutes from './routes/reports.js'
import assistantRoutes from './routes/assistant.js'
import attendanceRoutes from './routes/attendance.js'

const app = express()
app.disable('x-powered-by')

// Security, performance, logging
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'upgrade-insecure-requests': null,
    },
  },
}))
app.use(cors({ origin: corsOrigin }))
app.use(compression())
if (!env.isProd) app.use(morgan('dev'))
app.use(express.json({ limit: '100kb' }))
// Generous on purpose: a whole team behind one office IP shares this budget, and every open tab polls as a safety net.
// The reply is JSON (not the default plain text) so the app can show the message instead of "Something went wrong".
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000, limit: env.isProd ? 5000 : 20000, standardHeaders: true, legacyHeaders: false,
  skip: (req) => req.path === '/health',
  message: { error: 'Too many requests. Please wait a moment and try again.' },
}))

// API
app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api/auth', authRoutes)
app.use('/api/admin', authenticate, requireRole('admin'), adminRoutes)
app.use('/api/members', authenticate, memberRoutes)
app.use('/api/projects', authenticate, projectRoutes)
app.use('/api/tasks', authenticate, taskRoutes)
app.use('/api/notifications', authenticate, notificationRoutes)
app.use('/api/rewards', authenticate, rewardRoutes)
app.use('/api/chat', authenticate, chatRoutes)
app.use('/api/meetings', authenticate, meetingRoutes)
app.use('/api/attendance', authenticate, attendanceRoutes)
app.use('/api/assistant', authenticate, can('assistant:use'), assistantRoutes)
app.use('/api/reports', authenticate, can('report:view'), reportRoutes)
app.use('/api', notFound)

// In production, serve the built client from the same server
if (env.isProd) {
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist')
  app.use(express.static(dist))
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}

app.use(errorHandler)
export default app
