import Notification from '../models/Notification.js'

// Fire and forget: a failed notification must never fail the request that caused it
export const notifyMany = (userIds, data) =>
  userIds.length
    ? Notification.insertMany(userIds.map((userId) => ({ ...data, userId }))).catch((err) => console.error('Notify failed:', err.message))
    : undefined
