import Task from '../models/Task.js'
import Notification from '../models/Notification.js'

const DAY = 24 * 60 * 60 * 1000
const fmt = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

// Tell assignees about tasks that are due today/tomorrow or already overdue.
// Each reminder has a unique key, so running this again never creates duplicates.
export async function sendDueReminders() {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const tomorrow = new Date(today.getTime() + DAY)

  const tasks = await Task.find({
    status: { $ne: 'done' }, assigneeId: { $ne: null }, dueDate: { $ne: null, $lte: tomorrow },
  }).select('title projectId assigneeId dueDate')

  const ops = tasks.map((t) => {
    const overdue = t.dueDate < today
    const type = overdue ? 'overdue' : 'due-soon'
    const when = t.dueDate.getTime() === today.getTime() ? 'today' : 'tomorrow'
    return {
      updateOne: {
        filter: { key: `${type}:${t.id}:${t.dueDate.toISOString().slice(0, 10)}` },
        update: { $setOnInsert: {
          userId: t.assigneeId, type, projectId: t.projectId, taskId: t._id, read: false, at: new Date(),
          message: overdue ? `“${t.title}” is overdue (was due ${fmt(t.dueDate)})` : `“${t.title}” is due ${when}`,
        } },
        upsert: true,
      },
    }
  })
  if (ops.length) await Notification.collection.bulkWrite(ops, { ordered: false })
}
