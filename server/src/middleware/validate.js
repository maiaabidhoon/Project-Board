import { HttpError } from '../utils/HttpError.js'

/** Validate and replace req.body (or another source) with parsed zod data */
export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source])
  if (!result.success) return next(new HttpError(400, result.error.issues[0].message))
  req[source] = result.data
  next()
}

/** Use with router.param('id', validId) so bad ids return 400 instead of a database error */
export const validId = (_req, _res, next, id) =>
  /^[a-f\d]{24}$/i.test(id) ? next() : next(new HttpError(400, 'Invalid id'))
