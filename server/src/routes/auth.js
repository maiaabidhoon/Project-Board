import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import User from '../models/User.js'
import { authenticate, signToken } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { loginSchema, passwordChangeSchema } from '../schemas.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/HttpError.js'
import { userView } from '../utils/userView.js'
import { disconnectUser } from '../utils/realtime.js'

const router = Router()

// Slow down password guessing; successful logins don't count
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 20, skipSuccessfulRequests: true,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in a few minutes.' },
})

router.post('/login', loginLimiter, validate(loginSchema), asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+password')
  if (!user || !user.active || !(await user.verifyPassword(req.body.password)))
    throw new HttpError(401, 'Incorrect email or password')
  res.json({ token: signToken(user), user: userView(user) })
}))

router.get('/me', authenticate, (req, res) => res.json(userView(req.user)))

// Change your own password; returns a fresh token because older sessions are revoked
router.patch('/password', authenticate, loginLimiter, validate(passwordChangeSchema), asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('+password')
  if (!(await user.verifyPassword(req.body.currentPassword))) throw new HttpError(400, 'Current password is incorrect')
  user.password = req.body.newPassword
  await user.save()
  disconnectUser(user.id) // older sessions lose their live connection too; this tab reconnects with the new token
  res.json({ token: signToken(user), user: userView(user) })
}))

export default router
