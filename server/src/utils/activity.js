import Activity from '../models/Activity.js'
import { sync } from './realtime.js'

// Fire and forget: a failed log entry must never fail the request that caused it
export const logActivity = (projectId, actorId, message) =>
  Activity.create({ projectId, actorId, message })
    .then(() => sync([['activity'], ['admin']]))
    .catch((err) => console.error('Activity log failed:', err.message))
