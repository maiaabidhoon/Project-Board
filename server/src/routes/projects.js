import { Router } from 'express'
import Project from '../models/Project.js'
import Task from '../models/Task.js'
import Activity from '../models/Activity.js'
import User from '../models/User.js'
import { logActivity } from '../utils/activity.js'
import { can } from '../middleware/roles.js'
import { validate, validId } from '../middleware/validate.js'
import { projectSchema, taskCreateSchema } from '../schemas.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/HttpError.js'
import { sync } from '../utils/realtime.js'

const router = Router()
router.param('id', validId)

router.get('/', asyncHandler(async (_req, res) => res.json(await Project.find().sort('name'))))

router.post('/', can('project:create'), validate(projectSchema), asyncHandler(async (req, res) => {
  const project = await Project.create(req.body)
  sync([['projects'], ['report'], ['admin']])
  res.status(201).json(project)
}))

router.delete('/:id', can('project:delete'), asyncHandler(async (req, res) => {
  const project = await Project.findByIdAndDelete(req.params.id)
  if (!project) throw new HttpError(404, 'Project not found')
  await Promise.all([Task.deleteMany({ projectId: project.id }), Activity.deleteMany({ projectId: project.id })])
  sync([['projects'], ['tasks'], ['report'], ['admin']])
  res.status(204).end()
}))

router.get('/:id/tasks', asyncHandler(async (req, res) =>
  res.json(await Task.find({ projectId: req.params.id }).sort('createdAt'))))

router.post('/:id/tasks', can('task:create'), validate(taskCreateSchema), asyncHandler(async (req, res) => {
  if (!(await Project.exists({ _id: req.params.id }))) throw new HttpError(404, 'Project not found')
  const task = await Task.create({ projectId: req.params.id, title: req.body.title, createdBy: req.user.id })
  sync([['tasks'], ['report'], ['admin']])
  logActivity(task.projectId, req.user.id, `created “${task.title}”`)
  res.status(201).json(task)
}))

// Spreadsheet-friendly export. Cells that start with = + - @ are prefixed so Excel can't run them as formulas.
const cell = (v) => {
  let s = v == null ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

router.get('/:id/export', can('project:export'), asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id)
  if (!project) throw new HttpError(404, 'Project not found')
  const [tasks, users] = await Promise.all([Task.find({ projectId: project.id }).sort('createdAt'), User.find().select('name')])
  const nameOf = Object.fromEntries(users.map((u) => [u.id, u.name]))

  const rows = [['Title', 'Description', 'Status', 'Priority', 'Assignee', 'Due date', 'Checklist done', 'Checklist total', 'Comments', 'Created']]
  for (const t of tasks) rows.push([
    t.title, t.description, t.status, t.priority, nameOf[String(t.assigneeId)] ?? '', t.dueDate?.toISOString().slice(0, 10) ?? '',
    t.checklist.filter((c) => c.done).length, t.checklist.length, t.comments.length, t.createdAt.toISOString().slice(0, 10),
  ])

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${project.name.replace(/[^\w-]+/g, '-')}-tasks.csv"`)
  res.send('\ufeff' + rows.map((r) => r.map(cell).join(',')).join('\r\n')) // BOM so Excel reads UTF-8
}))

router.get('/:id/activity', asyncHandler(async (req, res) =>
  res.json(await Activity.find({ projectId: req.params.id }).sort('-at').limit(15))))

export default router
