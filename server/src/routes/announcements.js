import { Router } from 'express'
import Announcement from '../models/Announcement.js'
import User from '../models/User.js'
import { can, hasPermission } from '../middleware/roles.js'
import { validate, validId } from '../middleware/validate.js'
import { announcementSchema, announcementPinSchema } from '../schemas.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/HttpError.js'
import { notifyMany } from '../utils/notify.js'
import { sync } from '../utils/realtime.js'

// Mounted behind authenticate in app.js. Everyone reads; managers and admins post.
const router = Router()
router.param('id', validId)

const view = (a, names) => ({ id: a.id, title: a.title, body: a.body, pinned: a.pinned, at: a.at, author: { id: String(a.authorId), name: names[String(a.authorId)] ?? 'Former member' } })

router.get('/', asyncHandler(async (_req, res) => {
  const [rows, users] = await Promise.all([Announcement.find().sort('-pinned -at').limit(30), User.find().select('name')])
  const names = Object.fromEntries(users.map((u) => [u.id, u.name]))
  res.json(rows.map((a) => view(a, names)))
}))

router.post('/', can('announcement:post'), validate(announcementSchema), asyncHandler(async (req, res) => {
  const a = await Announcement.create({ ...req.body, authorId: req.user.id })
  const everyone = (await User.find({ active: true, _id: { $ne: req.user.id } }).select('_id')).map((u) => u.id)
  notifyMany(everyone, { type: 'announcement', message: `${req.user.name} posted an announcement: ${a.title}` })
  sync([['announcements']])
  res.status(201).json(view(a, { [req.user.id]: req.user.name }))
}))

// Pin or unpin: the author or an admin
router.patch('/:id', validate(announcementPinSchema), asyncHandler(async (req, res) => {
  const a = await Announcement.findById(req.params.id)
  if (!a) throw new HttpError(404, 'Announcement not found')
  if (String(a.authorId) !== req.user.id && !hasPermission(req.user, 'user:manage')) throw new HttpError(403, 'Only the author or an admin can change this')
  a.pinned = req.body.pinned
  await a.save()
  sync([['announcements']])
  res.json({ id: a.id, pinned: a.pinned })
}))

router.delete('/:id', asyncHandler(async (req, res) => {
  const a = await Announcement.findById(req.params.id)
  if (!a) throw new HttpError(404, 'Announcement not found')
  if (String(a.authorId) !== req.user.id && !hasPermission(req.user, 'user:manage')) throw new HttpError(403, 'Only the author or an admin can delete this')
  await a.deleteOne()
  sync([['announcements']])
  res.status(204).end()
}))

export default router
