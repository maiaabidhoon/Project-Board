import { Router } from 'express'
import User from '../models/User.js'
import Project from '../models/Project.js'
import Task from '../models/Task.js'
import Meeting from '../models/Meeting.js'
import Attendance from '../models/Attendance.js'
import AttendanceCode from '../models/AttendanceCode.js'
import Activity from '../models/Activity.js'
import Message from '../models/Message.js'
import RewardAdjustment from '../models/RewardAdjustment.js'
import { env } from '../config/env.js'
import { BADGES, levelFor } from '../config/rewards.js'
import { getRewardRules, saveRewardRules } from '../utils/rewardRules.js'
import { startOfToday } from '../utils/dates.js'
import { presence } from '../utils/realtime.js'
import { validate, validId } from '../middleware/validate.js'
import { userCreateSchema, userUpdateSchema, rewardRulesSchema, rewardAdjustSchema } from '../schemas.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/HttpError.js'
import { notifyMany } from '../utils/notify.js'
import { disconnectUser, sync } from '../utils/realtime.js'
import { purgeUserFromChats } from '../utils/chat.js'

// Mounted behind authenticate + requireRole('admin') in app.js
const router = Router()
router.param('id', validId)
router.param('userId', validId)

router.get('/stats', asyncHandler(async (_req, res) => {
  const [users, projects, grouped] = await Promise.all([
    User.countDocuments(),
    Project.countDocuments(),
    Task.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
  ])
  const byStatus = { todo: 0, doing: 0, done: 0, ...Object.fromEntries(grouped.map((g) => [g._id, g.n])) }
  res.json({ users, projects, tasks: byStatus.todo + byStatus.doing + byStatus.done, byStatus })
}))

router.get('/users', asyncHandler(async (_req, res) => res.json(await User.find().sort('createdAt'))))

router.post('/users', validate(userCreateSchema), asyncHandler(async (req, res) => {
  const user = await User.create(req.body)
  sync([['members'], ['admin']])
  res.status(201).json(user)
}))

router.patch('/users/:id', validate(userUpdateSchema), asyncHandler(async (req, res) => {
  const { name, role, active, password } = req.body
  if (req.params.id === req.user.id && (role !== undefined || active !== undefined))
    throw new HttpError(400, "You can't change your own role or status")

  const user = await User.findById(req.params.id)
  if (!user) throw new HttpError(404, 'User not found')
  if (name !== undefined) user.name = name
  const previousRole = user.role
  if (role !== undefined) user.role = role
  if (active !== undefined) user.active = active
  if (password) user.password = password
  await user.save()
  if (active === false) disconnectUser(user.id) // close their chat connections right away
  if (role !== undefined && role !== previousRole)
    notifyMany([user.id], { type: 'role', message: `${req.user.name} changed your role to ${role}` })
  sync([['members'], ['admin']])
  res.json(user)
}))

router.delete('/users/:id', asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id) throw new HttpError(400, "You can't delete your own account")
  if (!(await User.findByIdAndDelete(req.params.id))) throw new HttpError(404, 'User not found')
  await Task.updateMany({ assigneeId: req.params.id }, { assigneeId: null })
  await Promise.all([Meeting.deleteMany({ organizerId: req.params.id }), Meeting.updateMany({ attendees: req.params.id }, { $pull: { attendees: req.params.id } })])
  await Attendance.deleteMany({ userId: req.params.id })
  disconnectUser(req.params.id)
  await purgeUserFromChats(req.params.id)
  sync([['members'], ['admin'], ['tasks'], ['meetings'], ['report']])
  res.status(204).end()
}))

// ---------------------------------------------------------------------------------------------------------------
// Visual dashboard: one call returns everything the admin dashboard draws
const DAY = 24 * 60 * 60 * 1000
const TREND_DAYS = 14

router.get('/dashboard', asyncHandler(async (_req, res) => {
  const now = new Date()
  const today = startOfToday() // midnight (UTC) of today's date in the configured timezone, like due dates
  const first = new Date(today.getTime() - (TREND_DAYS - 1) * DAY)
  const days = Array.from({ length: TREND_DAYS }, (_, i) => new Date(first.getTime() + i * DAY).toISOString().slice(0, 10))
  const since = new Date(first.getTime() - DAY) // loose lower bound; buckets below are per local day
  const perDay = (field) => ({ $dateToString: { format: '%Y-%m-%d', date: field, timezone: env.timezone } })

  const [users, projects, tasks, created, moved, attended, taken, upcoming, messages, recent] = await Promise.all([
    User.find().select('name role active rewards.points'),
    Project.find().select('name').sort('name'),
    Task.find().select('status priority dueDate assigneeId projectId').lean(),
    Task.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: perDay('$createdAt'), n: { $sum: 1 } } }]),
    Activity.aggregate([{ $match: { at: { $gte: since }, message: /to Done$/ } }, { $group: { _id: perDay('$at'), n: { $sum: 1 } } }]),
    Attendance.aggregate([{ $match: { day: { $in: days } } }, { $group: { _id: '$day', n: { $sum: 1 } } }]),
    AttendanceCode.find({ day: { $in: days } }).select('day'),
    Meeting.countDocuments({ startsAt: { $gte: now } }),
    Message.countDocuments({ at: { $gte: new Date(now.getTime() - DAY) }, system: false }),
    Activity.find().sort('-at').limit(8),
  ])

  const active = users.filter((u) => u.active)
  const nameOf = Object.fromEntries(users.map((u) => [u.id, u.name]))
  const projectName = Object.fromEntries(projects.map((p) => [p.id, p.name]))

  const status = { todo: 0, doing: 0, done: 0 }
  const priority = { low: 0, medium: 0, high: 0 } // open tasks only
  const byProject = {}
  const byPerson = {}
  let overdue = 0
  for (const t of tasks) {
    const late = t.status !== 'done' && !!t.dueDate && t.dueDate < today
    status[t.status]++
    if (t.status !== 'done') priority[t.priority]++
    if (late) overdue++
    const p = (byProject[String(t.projectId)] ??= { todo: 0, doing: 0, done: 0, overdue: 0 })
    p[t.status]++
    if (late) p.overdue++
    const w = (byPerson[String(t.assigneeId ?? 'none')] ??= { open: 0, done: 0, overdue: 0 })
    w[t.status === 'done' ? 'done' : 'open']++
    if (late) w.overdue++
  }

  const count = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.n]))
  const createdBy = count(created), movedBy = count(moved), presentBy = count(attended)
  const takenDays = new Set(taken.map((c) => c.day))

  res.json({
    totals: {
      users: users.length, activeUsers: active.length, online: presence.list().length, projects: projects.length,
      tasks: tasks.length, open: status.todo + status.doing, done: status.done, overdue,
      upcomingMeetings: upcoming, messages24h: messages,
      attendanceToday: { present: presentBy[days.at(-1)] ?? 0, total: active.length, taken: takenDays.has(days.at(-1)) },
    },
    status, priority,
    roles: Object.fromEntries(['admin', 'manager', 'member'].map((r) => [r, active.filter((u) => u.role === r).length])),
    projects: projects.map((p) => ({ id: p.id, name: p.name, ...{ todo: 0, doing: 0, done: 0, overdue: 0 }, ...byProject[p.id] })),
    workload: Object.entries(byPerson)
      .map(([id, w]) => ({ id, name: id === 'none' ? 'Unassigned' : (nameOf[id] ?? 'Former member'), ...w }))
      .sort((a, b) => b.open - a.open).slice(0, 8),
    trend: days.map((day) => ({ day, created: createdBy[day] ?? 0, completed: movedBy[day] ?? 0, present: presentBy[day] ?? 0, taken: takenDays.has(day) })),
    leaders: [...active].sort((a, b) => b.rewards.points - a.rewards.points).slice(0, 5)
      .map((u) => ({ id: u.id, name: u.name, points: u.rewards.points, level: levelFor(u.rewards.points).name })),
    recent: recent.map((a) => ({ id: a.id, at: a.at, actor: nameOf[String(a.actorId)] ?? 'Someone', project: projectName[String(a.projectId)] ?? '', message: a.message })),
  })
}))

// ---------------------------------------------------------------------------------------------------------------
// Reward management
router.get('/rewards', asyncHandler(async (_req, res) => {
  const [rules, users, log] = await Promise.all([
    getRewardRules(),
    User.find({ active: true }).select('name role rewards').sort('name'),
    RewardAdjustment.find().sort('-at').limit(25),
  ])
  const names = Object.fromEntries((await User.find().select('name')).map((u) => [u.id, u.name]))
  res.json({
    rules,
    users: users.map((u) => ({
      id: u.id, name: u.name, role: u.role, points: u.rewards.points, level: levelFor(u.rewards.points).name,
      completed: u.rewards.completed, onTime: u.rewards.onTime, streak: u.rewards.streak, badges: u.rewards.badges.length,
    })),
    adjustments: log.map((a) => ({
      id: a.id, at: a.at, points: a.points, reason: a.reason, kind: a.kind,
      user: names[String(a.userId)] ?? 'Former member', by: names[String(a.byId)] ?? 'Former member',
    })),
  })
}))

router.put('/rewards/rules', validate(rewardRulesSchema), asyncHandler(async (req, res) => {
  const rules = await saveRewardRules(req.body, req.user.id)
  sync([['rewards']])
  res.json(rules)
}))

// Give or take away points by hand (never below zero)
router.post('/rewards/adjust', validate(rewardAdjustSchema), asyncHandler(async (req, res) => {
  const { userId, points, reason } = req.body
  const user = await User.findById(userId).select('name active rewards')
  if (!user || !user.active) throw new HttpError(404, 'User not found')

  const r = user.rewards
  const next = Math.max(0, r.points + points)
  const delta = next - r.points
  if (!delta) throw new HttpError(400, `${user.name} already has 0 points, so there is nothing to take away`)

  // Adding points can unlock the points-based badge, just like finishing a task would
  const have = new Set(r.badges.map((b) => b.key))
  const stats = { points: next, completed: r.completed, onTime: r.onTime, high: r.high, longestStreak: r.longestStreak }
  const earned = delta > 0 ? BADGES.filter((b) => !have.has(b.key) && b.check(stats)) : []
  await User.updateOne({ _id: userId }, {
    $set: { 'rewards.points': next },
    ...(earned.length && { $push: { 'rewards.badges': { $each: earned.map((b) => ({ key: b.key, at: new Date() })) } } }),
  })
  await RewardAdjustment.create({ userId, byId: req.user.id, points: delta, reason })

  const tell = (message) => notifyMany([userId], { type: 'reward', message })
  tell(`${req.user.name} ${delta > 0 ? 'awarded you' : 'removed'} ${Math.abs(delta)} points: ${reason}`)
  earned.forEach((b) => tell(`Badge unlocked: ${b.name}. ${b.description}`))
  if (levelFor(next).level > levelFor(r.points).level) tell(`You reached level ${levelFor(next).level}: ${levelFor(next).name}`)

  sync([['rewards'], ['admin']])
  res.json({ id: user.id, points: next, delta })
}))

// Start someone's rewards from scratch (points, streaks and badges). Their task history stays.
router.post('/rewards/reset/:userId', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.userId).select('name rewards')
  if (!user) throw new HttpError(404, 'User not found')
  const before = user.rewards.points
  await User.updateOne({ _id: user.id }, {
    $set: { rewards: { points: 0, completed: 0, onTime: 0, high: 0, streak: 0, longestStreak: 0, lastCompletedOn: null, badges: [] } },
  })
  await RewardAdjustment.create({ userId: user.id, byId: req.user.id, points: -before, reason: 'Rewards reset by admin', kind: 'reset' })
  notifyMany([user.id], { type: 'reward', message: `${req.user.name} reset your rewards` })
  sync([['rewards'], ['admin']])
  res.status(204).end()
}))

export default router
