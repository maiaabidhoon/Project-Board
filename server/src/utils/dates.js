import { env } from '../config/env.js'

/**
 * Midnight (UTC) of today's calendar date in the configured TIMEZONE.
 * Due dates are stored as date-only values at UTC midnight, so "overdue" means dueDate < this value.
 * (Using the server clock directly would call a task overdue for the whole of its due day.)
 */
export function startOfToday(now = new Date()) {
  const ymd = now.toLocaleDateString('en-CA', { timeZone: env.timezone }) // YYYY-MM-DD
  return new Date(`${ymd}T00:00:00.000Z`)
}
