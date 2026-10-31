import { Router } from 'express'
import User from '../models/User.js'
import Project from '../models/Project.js'
import Task from '../models/Task.js'
import Meeting from '../models/Meeting.js'
import { validate, validId } from '../middleware/validate.js'
import { userCreateSchema, userUpdateSchema } from '../schemas.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/HttpError.js'
import { notifyMany } from '../utils/notify.js'
import { disconnectUser } from '../utils/realtime.js'
import { purgeUserFromChats } from '../utils/chat.js'

// Mounted behind authenticate + requireRole('admin') in app.js
const router = Router()
router.param('id', validId)

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

router.post('/users', validate(userCreateSchema), asyncHandler(async (req, res) =>
  res.status(201).json(await User.create(req.body))))

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
  res.json(user)
}))

router.delete('/users/:id', asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id) throw new HttpError(400, "You can't delete your own account")
  if (!(await User.findByIdAndDelete(req.params.id))) throw new HttpError(404, 'User not found')
  await Task.updateMany({ assigneeId: req.params.id }, { assigneeId: null })
  await Promise.all([Meeting.deleteMany({ organizerId: req.params.id }), Meeting.updateMany({ attendees: req.params.id }, { $pull: { attendees: req.params.id } })])
  disconnectUser(req.params.id)
  await purgeUserFromChats(req.params.id)
  res.status(204).end()
}))

export default router
