import { Router } from 'express'
import Notification from '../models/Notification.js'
import { validId } from '../middleware/validate.js'
import { asyncHandler } from '../utils/asyncHandler.js'

// Every user only ever sees their own notifications
const router = Router()
router.param('id', validId)

router.get('/', asyncHandler(async (req, res) => {
  const [items, unread] = await Promise.all([
    Notification.find({ userId: req.user.id }).sort('-at').limit(30),
    Notification.countDocuments({ userId: req.user.id, read: false }),
  ])
  res.json({ items, unread })
}))

router.patch('/read-all', asyncHandler(async (req, res) => {
  await Notification.updateMany({ userId: req.user.id, read: false }, { read: true })
  res.status(204).end()
}))

router.patch('/:id/read', asyncHandler(async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, userId: req.user.id }, { read: true })
  res.status(204).end()
}))

export default router
