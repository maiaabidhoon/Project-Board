import { env } from '../config/env.js'
import { HttpError } from '../utils/HttpError.js'

export const notFound = (req, _res, next) =>
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`))

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  let status = err.status || 500
  let message = err.message

  if (err.code === 11000) { status = 409; message = err.keyPattern?.email ? 'That email is already in use' : 'That value already exists' }
  else if (err.name === 'ValidationError') { status = 400; message = Object.values(err.errors)[0].message }
  else if (err.name === 'CastError') { status = 400; message = 'Invalid id' }
  else if (err.type === 'entity.parse.failed') { status = 400; message = 'Invalid JSON' }

  if (status >= 500) {
    console.error(err)
    if (env.isProd) message = 'Something went wrong'
  }
  res.status(status).json({ error: message })
}
