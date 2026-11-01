import { Router } from 'express'
import Task from '../models/Task.js'
import User from '../models/User.js'
import Project from '../models/Project.js'
import Meeting from '../models/Meeting.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { startOfToday } from '../utils/dates.js'

// Mounted behind can('report:view') in app.js
const router = Router()

const count = (cond) => ({ $sum: { $cond: [cond, 1, 0] } })

router.get('/overview', asyncHandler(async (_req, res) => {
  const now = new Date()
  const today = startOfToday() // a task due today is not overdue until tomorrow
  const isOpen = { $ne: ['$status', 'done'] }
  const isLate = { $and: [isOpen, { $ne: ['$dueDate', null] }, { $lt: ['$dueDate', today] }] }
  const tally = {
    todo: count({ $eq: ['$status', 'todo'] }),
    doing: count({ $eq: ['$status', 'doing'] }),
    done: count({ $eq: ['$status', 'done'] }),
    overdue: count(isLate),
  }

  const [byPriority, byAssignee, byProject, users, projects, upcomingMeetings] = await Promise.all([
    Task.aggregate([{ $group: { _id: '$priority', n: { $sum: 1 } } }]),
    Task.aggregate([{ $group: { _id: '$assigneeId', ...tally } }]),
    Task.aggregate([{ $group: { _id: '$projectId', ...tally } }]),
    User.find({ active: true }).select('name'),
    Project.find().select('name').sort('name'),
    Meeting.countDocuments({ startsAt: { $gte: now } }),
  ])

  const sum = (rows, key) => rows.reduce((n, r) => n + r[key], 0)
  const assigneeRow = (id) => byAssignee.find((r) => String(r._id) === String(id))
  const projectRow = (id) => byProject.find((r) => String(r._id) === id)
  const pick = (r = {}) => ({ todo: r.todo ?? 0, doing: r.doing ?? 0, done: r.done ?? 0, overdue: r.overdue ?? 0 })

  const todo = sum(byAssignee, 'todo'), doing = sum(byAssignee, 'doing'), done = sum(byAssignee, 'done')
  res.json({
    totals: { tasks: todo + doing + done, done, overdue: sum(byAssignee, 'overdue'), projects: projects.length, upcomingMeetings },
    byStatus: { todo, doing, done },
    byPriority: { low: 0, medium: 0, high: 0, ...Object.fromEntries(byPriority.map((r) => [r._id, r.n])) },
    unassigned: pick(assigneeRow(null)),
    assignees: users.map((u) => ({ id: u.id, name: u.name, ...pick(assigneeRow(u.id)) })),
    projects: projects.map((p) => ({ id: p.id, name: p.name, ...pick(projectRow(p.id)) })),
  })
}))

export default router
