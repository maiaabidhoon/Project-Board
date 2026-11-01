import { Router } from 'express'
import Meeting from '../models/Meeting.js'
import Project from '../models/Project.js'
import User from '../models/User.js'
import { env } from '../config/env.js'
import { can } from '../middleware/roles.js'
import { validate, validId } from '../middleware/validate.js'
import { meetingSchema, meetingUpdateSchema } from '../schemas.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/HttpError.js'
import { notifyMany } from '../utils/notify.js'
import { sync } from '../utils/realtime.js'

// You only ever see meetings you organize or are invited to
const router = Router()
router.param('id', validId)

const when = (d) => d.toLocaleString('en-IN', { timeZone: env.timezone, dateStyle: 'medium', timeStyle: 'short' })
const others = (ids, me) => [...new Set(ids.map(String))].filter((id) => id !== String(me))

async function checkLinks({ attendees, projectId }) {
  if (attendees?.length && (await User.countDocuments({ _id: { $in: attendees }, active: true })) !== attendees.length)
    throw new HttpError(400, 'Some of the people you invited are not available')
  if (projectId && !(await Project.exists({ _id: projectId }))) throw new HttpError(400, 'Project not found')
}

router.get('/', asyncHandler(async (req, res) =>
  res.json(await Meeting.find({ $or: [{ organizerId: req.user.id }, { attendees: req.user.id }] }).sort('startsAt').limit(300))))

router.post('/', can('meeting:create'), validate(meetingSchema), asyncHandler(async (req, res) => {
  const { attendeeIds, ...data } = req.body
  const attendees = others(attendeeIds, req.user.id)
  await checkLinks({ attendees, projectId: data.projectId })
  const meeting = await Meeting.create({ ...data, attendees, organizerId: req.user.id })
  notifyMany(attendees, { type: 'meeting', message: `${req.user.name} invited you to “${meeting.title}” on ${when(meeting.startsAt)}` })
  sync([['meetings']], [req.user.id, ...attendees])
  res.status(201).json(meeting)
}))

router.patch('/:id', validate(meetingUpdateSchema), asyncHandler(async (req, res) => {
  const meeting = await Meeting.findById(req.params.id)
  if (!meeting) throw new HttpError(404, 'Meeting not found')
  if (String(meeting.organizerId) !== req.user.id) throw new HttpError(403, 'Only the organizer can change this meeting')

  const { attendeeIds, ...data } = req.body
  const before = { time: meeting.startsAt.getTime(), people: meeting.attendees.map(String) }
  const attendees = attendeeIds ? others(attendeeIds, req.user.id) : null
  await checkLinks({ attendees: attendees?.filter((id) => !before.people.includes(id)), projectId: data.projectId })
  Object.assign(meeting, data)
  if (attendees) meeting.attendees = attendees
  await meeting.save()

  const added = (attendees ?? []).filter((id) => !before.people.includes(id))
  notifyMany(added, { type: 'meeting', message: `${req.user.name} invited you to “${meeting.title}” on ${when(meeting.startsAt)}` })
  if (meeting.startsAt.getTime() !== before.time)
    notifyMany(meeting.attendees.map(String).filter((id) => !added.includes(id)), { type: 'meeting', message: `“${meeting.title}” moved to ${when(meeting.startsAt)}` })
  sync([['meetings']], [req.user.id, ...before.people, ...meeting.attendees.map(String)])
  res.json(meeting)
}))

router.delete('/:id', asyncHandler(async (req, res) => {
  const meeting = await Meeting.findById(req.params.id)
  if (!meeting) throw new HttpError(404, 'Meeting not found')
  if (String(meeting.organizerId) !== req.user.id) throw new HttpError(403, 'Only the organizer can cancel this meeting')
  await meeting.deleteOne()
  notifyMany(meeting.attendees.map(String), { type: 'meeting', message: `${req.user.name} cancelled “${meeting.title}”` })
  sync([['meetings']], [req.user.id, ...meeting.attendees.map(String)])
  res.status(204).end()
}))

export default router
