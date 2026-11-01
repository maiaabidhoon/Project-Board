import { Router } from 'express'
import Task from '../models/Task.js'
import User from '../models/User.js'
import { can, canActOn, hasPermission } from '../middleware/roles.js'
import { validate, validId } from '../middleware/validate.js'
import { checklistSchema, commentSchema, taskUpdateSchema } from '../schemas.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/HttpError.js'
import { logActivity } from '../utils/activity.js'
import { notifyMany } from '../utils/notify.js'
import { awardCompletion } from '../utils/rewards.js'
import { sync } from '../utils/realtime.js'

const router = Router()
router.param('id', validId)

const STATUS_LABEL = { todo: 'To do', doing: 'In progress', done: 'Done' }
const fmtDate = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const forbidden = () => new HttpError(403, 'You do not have permission to do this')

// Recipients without duplicates, empty values, or the person who did the action
const others = (actor, ids) => [...new Set(ids.filter(Boolean).map(String))].filter((id) => id !== String(actor.id))

// Everything assigned to the signed-in user, across all projects
router.get('/mine', asyncHandler(async (req, res) =>
  res.json(await Task.find({ assigneeId: req.user.id }).sort('dueDate createdAt'))))

router.patch('/:id', validate(taskUpdateSchema), asyncHandler(async (req, res) => {
  const { title, status, assigneeId, priority, dueDate, description } = req.body
  const existing = await Task.findById(req.params.id).select('title status assigneeId projectId createdBy')
  if (!existing) throw new HttpError(404, 'Task not found')

  // Members may move only tasks assigned to them; editing details is for managers and admins
  const edits = [title, assigneeId, priority, dueDate, description].some((v) => v !== undefined)
  if (edits && !hasPermission(req.user, 'task:edit')) throw forbidden()
  if (status !== undefined && !canActOn(req.user, existing, 'task:move')) throw forbidden()

  const assignee = assigneeId ? await User.findOne({ _id: assigneeId, active: true }).select('name') : null
  if (assigneeId && !assignee) throw new HttpError(400, 'That person is not available')

  const task = await Task.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true })
  if (!task) throw new HttpError(404, 'Task not found')

  const actor = req.user.name
  const name = `“${task.title}”`
  const log = (message) => logActivity(task.projectId, req.user.id, message)
  const tell = (ids, type, message) =>
    notifyMany(others(req.user, ids), { type, message, projectId: task.projectId, taskId: task.id })

  const reassigned = assigneeId !== undefined && String(existing.assigneeId ?? '') !== String(assigneeId ?? '')
  const current = reassigned ? null : task.assigneeId // a new assignee is already told by the "assigned" message

  if (reassigned) {
    log(assignee ? `assigned ${name} to ${assignee.name}` : `unassigned ${name}`)
    if (assigneeId) tell([assigneeId], 'assigned', `${actor} assigned you ${name}`)
    if (existing.assigneeId) tell([existing.assigneeId], 'assigned', `${actor} removed you from ${name}`)
  }
  if (status !== undefined && status !== existing.status) {
    log(`moved ${name} to ${STATUS_LABEL[status]}`)
    // The assignee hears about changes others make; the person who created the task hears when it is done
    tell([current, status === 'done' ? task.createdBy : null], 'status', `${actor} moved ${name} to ${STATUS_LABEL[status]}`)
  }
  let reward = null
  if (status === 'done' && existing.status !== 'done') reward = await awardCompletion(task)
  if (description !== undefined) log(`updated the description of ${name}`)
  if (title !== undefined) { log(`renamed a task to ${name}`); tell([current], 'task', `${actor} renamed one of your tasks to ${name}`) }
  if (priority !== undefined) { log(`set ${name} to ${priority} priority`); tell([current], 'task', `${actor} set ${name} to ${priority} priority`) }
  if (dueDate !== undefined) {
    log(dueDate ? `set a due date on ${name}` : `cleared the due date on ${name}`)
    tell([current], 'task', dueDate ? `${actor} set the due date of ${name} to ${fmtDate(dueDate)}` : `${actor} cleared the due date of ${name}`)
  }

  // Only the person who earned the points sees the celebration; everyone else finds out via notifications
  sync([['tasks'], ['report']] .concat(reward ? [['rewards']] : []))
  const body = task.toJSON()
  if (reward && reward.userId === String(req.user.id)) body.reward = reward
  res.json(body)
}))

// Replace a task's checklist (assignee, manager or admin)
router.put('/:id/checklist', validate(checklistSchema), asyncHandler(async (req, res) => {
  const existing = await Task.findById(req.params.id).select('assigneeId')
  if (!existing) throw new HttpError(404, 'Task not found')
  if (!canActOn(req.user, existing, 'task:checklist')) throw forbidden()
  const updated = await Task.findByIdAndUpdate(req.params.id, { checklist: req.body.items }, { new: true, runValidators: true })
  sync([['tasks']])
  res.json(updated)
}))

router.delete('/:id', can('task:delete'), asyncHandler(async (req, res) => {
  const task = await Task.findByIdAndDelete(req.params.id)
  if (!task) throw new HttpError(404, 'Task not found')
  sync([['tasks'], ['report']])
  logActivity(task.projectId, req.user.id, `deleted “${task.title}”`)
  notifyMany(others(req.user, [task.assigneeId]), {
    type: 'task', projectId: task.projectId, message: `${req.user.name} deleted “${task.title}”, which was assigned to you`,
  })
  res.status(204).end()
}))

router.post('/:id/comments', validate(commentSchema), asyncHandler(async (req, res) => {
  const existing = await Task.findById(req.params.id).select('assigneeId')
  if (!existing) throw new HttpError(404, 'Task not found')
  if (!canActOn(req.user, existing, 'comment:create')) throw forbidden() // members: own tasks only

  const task = await Task.findByIdAndUpdate(
    req.params.id,
    { $push: { comments: { authorId: req.user.id, text: req.body.text } } },
    { new: true, runValidators: true },
  )
  if (!task) throw new HttpError(404, 'Task not found')
  sync([['tasks']])
  logActivity(task.projectId, req.user.id, `commented on “${task.title}”`)
  notifyMany(others(req.user, [task.assigneeId, task.createdBy]), {
    type: 'comment', projectId: task.projectId, taskId: task.id, message: `${req.user.name} commented on “${task.title}”`,
  })
  res.status(201).json(task.comments.at(-1))
}))

export default router
