import mongoose from 'mongoose'
import app from './app.js'
import { env } from './config/env.js'
import { connectDB } from './config/db.js'
import { seed } from './utils/seed.js'
import { sendDueReminders } from './utils/reminders.js'

await connectDB()
await seed()

const server = app.listen(env.port, () => console.log(`API ready on http://localhost:${env.port}`))

// Due-date reminders: once now, then hourly (each reminder is only ever created once)
const remind = () => sendDueReminders().catch((err) => console.error('Reminder job failed:', err.message))
remind()
setInterval(remind, 60 * 60 * 1000).unref()

const shutdown = () => server.close(async () => { await mongoose.disconnect(); process.exit(0) })
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
