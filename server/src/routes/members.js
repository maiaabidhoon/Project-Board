import { Router } from 'express'
import User from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// Active teammates (name and role only) for assignee pickers
router.get('/', asyncHandler(async (_req, res) => {
  res.json(await User.find({ active: true }).select('name role').sort('name'))
}))

export default router
