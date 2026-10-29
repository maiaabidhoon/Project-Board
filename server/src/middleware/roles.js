import { PERMISSIONS, ROLES } from '../config/permissions.js'
import { HttpError } from '../utils/HttpError.js'

const forbidden = () => new HttpError(403, 'You do not have permission to do this')

export const hasPermission = (user, permission) => PERMISSIONS[permission]?.includes(user.role) ?? false

/** Permission on one task: the general permission, or its ':own' variant when the task is assigned to the user */
export const canActOn = (user, task, permission) =>
  hasPermission(user, permission) ||
  (hasPermission(user, `${permission}:own`) && String(task.assigneeId) === String(user.id))

/** Allow only the listed roles:  requireRole('admin') */
export const requireRole = (...roles) => (req, _res, next) =>
  next(roles.includes(req.user.role) ? undefined : forbidden())

/** Allow a role and anything above it:  requireMinRole('manager') */
export const requireMinRole = (min) => (req, _res, next) =>
  next(ROLES.indexOf(req.user.role) >= ROLES.indexOf(min) ? undefined : forbidden())

/** Allow by named permission (see config/permissions.js):  can('task:create') */
export const can = (permission) => (req, _res, next) =>
  next(hasPermission(req.user, permission) ? undefined : forbidden())
