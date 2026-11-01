import crypto from 'node:crypto'
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import Attendance from '../models/Attendance.js'
import AttendanceCode from '../models/AttendanceCode.js'
import User from '../models/User.js'
import { env } from '../config/env.js'
import { can, hasPermission } from '../middleware/roles.js'
import { validate } from '../middleware/validate.js'
import { otpEntrySchema, otpSendSchema, attendanceDaySchema, attendanceMonthSchema } from '../schemas.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/HttpError.js'
import { dayOf } from '../utils/rewards.js'
import { memberIds, postMessage } from '../utils/chat.js'
import { ensureOtpChat, OTP_CHAT_NAME } from '../utils/attendance.js'
import { emitToUsers, sync } from '../utils/realtime.js'

// Daily attendance by OTP. The admin sends today's OTP into the "Project Board OTP" chat; everyone who enters it
// is marked present for that day (once). Mounted behind authenticate in app.js.
const router = Router()

// A 6-digit code can be guessed, so wrong tries are limited per person (correct entries are not counted)
const markLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, limit: 8, skipSuccessfulRequests: true, keyGenerator: (req) => req.user.id,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many wrong OTPs. Wait a few minutes and try again.' },
})

const today = () => dayOf(new Date())
const monthOf = (q) => q.month ?? today().slice(0, 7)
const monthRange = (month) => ({ $gte: `${month}-01`, $lte: `${month}-31` }) // YYYY-MM-DD strings sort correctly
const pretty = (day) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const clock = (d) => d.toLocaleTimeString('en-IN', { timeZone: env.timezone, hour: 'numeric', minute: '2-digit' })

// Admin: create today's OTP and post it in the OTP chat for everyone
router.post('/otp', can('attendance:send'), validate(otpSendSchema), asyncHandler(async (req, res) => {
  const day = today()
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
  const expiresAt = new Date(Date.now() + req.body.validMinutes * 60_000)
  await AttendanceCode.findOneAndUpdate({ day }, { code, expiresAt, issuedBy: req.user.id, issuedAt: new Date() }, { upsert: true })

  const people = await User.find({ active: true }).select('_id')
  const conv = await ensureOtpChat(people.map((u) => u.id))
  const everyone = memberIds(conv)
  emitToUsers(everyone, 'conversation:changed', { id: conv.id }) // the chat appears for people who haven't opened it yet
  await postMessage({
    conversationId: conv.id, recipientIds: everyone, botName: OTP_CHAT_NAME,
    text: `Attendance OTP for ${pretty(day)}: ${code}\nValid for ${req.body.validMinutes} minutes (until ${clock(expiresAt)}). Enter it below to mark your attendance.`,
  })
  sync([['attendance']])
  res.status(201).json({ day, code, expiresAt })
}))

// Everyone: enter the OTP
router.post('/mark', markLimiter, can('attendance:mark'), validate(otpEntrySchema), asyncHandler(async (req, res) => {
  const day = today()
  const entry = await AttendanceCode.findOne({ day })
  if (!entry) throw new HttpError(400, 'No OTP has been sent today yet')
  if (entry.expiresAt < new Date()) throw new HttpError(400, 'This OTP has expired. Ask the admin to send a new one')

  const given = Buffer.from(req.body.otp)
  const real = Buffer.from(entry.code)
  if (given.length !== real.length || !crypto.timingSafeEqual(given, real)) throw new HttpError(400, 'Incorrect OTP')

  let already = false
  try {
    const result = await Attendance.updateOne({ userId: req.user.id, day }, { $setOnInsert: { markedAt: new Date() } }, { upsert: true })
    already = result.upsertedCount === 0
  } catch (err) {
    if (err.code !== 11000) throw err
    already = true // two submissions at the same instant
  }
  const record = await Attendance.findOne({ userId: req.user.id, day })
  if (!already) sync([['attendance']])
  res.json({ day, already, markedAt: record.markedAt })
}))

// Everyone: today's state for me
router.get('/today', asyncHandler(async (req, res) => {
  const day = today()
  const [entry, mine] = await Promise.all([AttendanceCode.findOne({ day }), Attendance.findOne({ userId: req.user.id, day })])
  const active = !!entry && entry.expiresAt > new Date()
  res.json({
    day, otpSent: !!entry, otpActive: active, expiresAt: entry?.expiresAt ?? null,
    marked: !!mine, markedAt: mine?.markedAt ?? null,
    code: hasPermission(req.user, 'attendance:send') && active ? entry.code : undefined, // only the admin can see the live code
  })
}))

// Everyone: which days I was present in a month
router.get('/me', validate(attendanceMonthSchema, 'query'), asyncHandler(async (req, res) => {
  const month = monthOf(req.query)
  const [rows, daysTaken] = await Promise.all([
    Attendance.find({ userId: req.user.id, day: monthRange(month) }).sort('day'),
    AttendanceCode.countDocuments({ day: monthRange(month) }),
  ])
  res.json({ month, days: rows.map((r) => ({ day: r.day, markedAt: r.markedAt })), daysTaken })
}))

// Managers and admins: the roster for one day (default today)
router.get('/day', can('attendance:view'), validate(attendanceDaySchema, 'query'), asyncHandler(async (req, res) => {
  const day = req.query.date ?? today()
  const [users, rows, code] = await Promise.all([
    User.find({ active: true }).select('name role').sort('name'),
    Attendance.find({ day }),
    AttendanceCode.exists({ day }),
  ])
  const at = Object.fromEntries(rows.map((r) => [String(r.userId), r.markedAt]))
  const people = users.map((u) => ({ id: u.id, name: u.name, role: u.role, present: !!at[u.id], markedAt: at[u.id] ?? null }))
  res.json({ day, otpSent: !!code, present: people.filter((p) => p.present).length, total: people.length, people })
}))

// Managers and admins: days present per person in a month
router.get('/month', can('attendance:view'), validate(attendanceMonthSchema, 'query'), asyncHandler(async (req, res) => {
  const month = monthOf(req.query)
  const [users, grouped, daysTaken] = await Promise.all([
    User.find({ active: true }).select('name role').sort('name'),
    Attendance.aggregate([{ $match: { day: monthRange(month) } }, { $group: { _id: '$userId', days: { $sum: 1 } } }]),
    AttendanceCode.countDocuments({ day: monthRange(month) }), // days on which attendance was actually taken
  ])
  const count = Object.fromEntries(grouped.map((g) => [String(g._id), g.days]))
  res.json({ month, daysTaken, people: users.map((u) => ({ id: u.id, name: u.name, role: u.role, days: count[u.id] ?? 0 })) })
}))

export default router
