import Notification from '../models/Notification.js'
import { sync } from './realtime.js'

// Fire and forget: a failed notification must never fail the request that caused it.
// Recipients' bells refresh instantly through the socket (polling remains as a safety net).
export const notifyMany = (userIds, data) =>
  userIds.length
    ? Notification.insertMany(userIds.map((userId) => ({ ...data, userId })))
        .then(() => sync([['notifications']], userIds))
        .catch((err) => console.error('Notify failed:', err.message))
    : undefined
