import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import User from '../models/User.js'
import { HttpError } from '../utils/HttpError.js'
import { asyncHandler } from '../utils/asyncHandler.js'

export const signToken = (user) => jwt.sign({ id: user.id }, env.jwtSecret, { expiresIn: env.jwtExpires })

// Verifies the token, then loads the user fresh so role changes and deactivation apply immediately
export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) throw new HttpError(401, 'Please sign in')

  let payload
  try { payload = jwt.verify(header.slice(7), env.jwtSecret) }
  catch { throw new HttpError(401, 'Your session has expired. Please sign in again') }

  const user = await User.findById(payload.id).select('name email role active passwordChangedAt')
  const staleSession = user?.passwordChangedAt && payload.iat * 1000 < user.passwordChangedAt.getTime() - 1000
  if (!user?.active || staleSession) throw new HttpError(401, 'Please sign in again')
  req.user = user
  next()
})
