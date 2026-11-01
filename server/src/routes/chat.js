import { Router } from 'express'
import Conversation from '../models/Conversation.js'
import Message from '../models/Message.js'
import User from '../models/User.js'
import { hasPermission } from '../middleware/roles.js'
import { validate, validId } from '../middleware/validate.js'
import {
  messageSchema, conversationCreateSchema, groupRenameSchema, addMembersSchema, messagesQuerySchema,
} from '../schemas.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/HttpError.js'
import { emitToUsers } from '../utils/realtime.js'
import { ensureOtpChat } from '../utils/attendance.js'
import {
  MAX_GROUP_MEMBERS, sameId, memberIds, messageView, listConversations, loadConversationView,
  postMessage, deleteConversation,
} from '../utils/chat.js'

// Everything here is private to the members of each conversation: anyone else just gets a 404
const router = Router()
router.param('id', validId)
router.param('userId', validId)

const PAGE = 50

async function mine(id, userId) {
  const conv = await Conversation.findOne({ _id: id, 'members.userId': userId })
  if (!conv) throw new HttpError(404, 'Conversation not found')
  return conv
}

function requireOwner(conv, user) {
  if (conv.type !== 'group') throw new HttpError(400, 'This only applies to groups')
  if (!sameId(conv.ownerId, user.id)) throw new HttpError(403, 'Only the group owner can do this')
}

const system = (conv, recipientIds, text) => postMessage({ conversationId: conv.id, recipientIds, text, system: true })
const changed = (conv, ids = memberIds(conv)) => emitToUsers(ids, 'conversation:changed', { id: conv.id })

router.get('/conversations', asyncHandler(async (req, res) => {
  await ensureOtpChat([req.user.id]) // everyone has the "Project Board OTP" chat
  res.json(await listConversations(req.user.id))
}))

// Start a direct chat (re-uses the existing one if there is one) or create a group
router.post('/conversations', validate(conversationCreateSchema), asyncHandler(async (req, res) => {
  const me = req.user.id

  if (req.body.type === 'dm') {
    const { userId } = req.body
    if (userId === me) throw new HttpError(400, "You can't message yourself")
    if (!(await User.exists({ _id: userId, active: true }))) throw new HttpError(404, 'User not found')

    const dmKey = [me, userId].sort().join(':')
    let conv = await Conversation.findOne({ dmKey })
    let created = false
    if (!conv) {
      try {
        conv = await Conversation.create({ type: 'dm', dmKey, members: [{ userId: me }, { userId }] })
        created = true
      } catch (err) {
        if (err.code !== 11000) throw err
        conv = await Conversation.findOne({ dmKey }) // both people started the chat at the same moment
      }
    }
    if (created) changed(conv)
    return res.status(created ? 201 : 200).json(await loadConversationView(conv.id, me))
  }

  // Group
  if (!hasPermission(req.user, 'chat:group:create')) throw new HttpError(403, 'You do not have permission to do this')
  const others = [...new Set(req.body.memberIds)].filter((id) => id !== me)
  if (!others.length) throw new HttpError(400, 'Pick at least one other member')
  if (others.length + 1 > MAX_GROUP_MEMBERS) throw new HttpError(400, `A group can have up to ${MAX_GROUP_MEMBERS} members`)
  if ((await User.countDocuments({ _id: { $in: others }, active: true })) !== others.length)
    throw new HttpError(400, 'Some of the people you picked are not available')

  const conv = await Conversation.create({
    type: 'group', name: req.body.name, ownerId: me,
    members: [me, ...others].map((userId) => ({ userId })),
  })
  changed(conv)
  await system(conv, memberIds(conv), `${req.user.name} created the group “${conv.name}”`)
  res.status(201).json(await loadConversationView(conv.id, me))
}))

// Newest 50 messages, or the 50 before ?before=<message id>. People only see messages from after they joined.
router.get('/conversations/:id/messages', validate(messagesQuerySchema, 'query'), asyncHandler(async (req, res) => {
  const conv = await mine(req.params.id, req.user.id)
  const me = conv.members.find((m) => sameId(m.userId, req.user.id))
  const filter = { conversationId: conv._id, at: { $gte: me.joinedAt } }
  if (req.query.before) filter._id = { $lt: req.query.before }

  const rows = await Message.find(filter).sort('-_id').limit(PAGE + 1)
  const hasMore = rows.length > PAGE
  if (hasMore) rows.pop()
  res.json({ messages: rows.reverse().map(messageView), hasMore })
}))

// The app sends messages over the socket; this is the same thing over plain HTTP, used when the socket is down
router.post('/conversations/:id/messages', validate(messageSchema), asyncHandler(async (req, res) => {
  const conv = await mine(req.params.id, req.user.id)
  if (conv.type === 'otp') throw new HttpError(403, 'This chat is read-only. Enter the OTP below to mark your attendance')
  const message = await postMessage({
    conversationId: conv.id, recipientIds: memberIds(conv), sender: { id: req.user.id, name: req.user.name }, text: req.body.text,
  })
  res.status(201).json(message)
}))

router.post('/conversations/:id/read', asyncHandler(async (req, res) => {
  const conv = await mine(req.params.id, req.user.id)
  await Conversation.updateOne({ _id: conv._id, 'members.userId': req.user.id }, { $set: { 'members.$.lastReadAt': new Date() } })
  emitToUsers([req.user.id], 'conversation:read', { conversationId: conv.id }) // clears the badge in your other tabs
  res.status(204).end()
}))

router.patch('/conversations/:id', validate(groupRenameSchema), asyncHandler(async (req, res) => {
  const conv = await mine(req.params.id, req.user.id)
  requireOwner(conv, req.user)
  if (conv.name !== req.body.name) {
    await Conversation.updateOne({ _id: conv._id }, { name: req.body.name })
    changed(conv)
    await system(conv, memberIds(conv), `${req.user.name} renamed the group to “${req.body.name}”`)
  }
  res.json(await loadConversationView(conv.id, req.user.id))
}))

router.post('/conversations/:id/members', validate(addMembersSchema), asyncHandler(async (req, res) => {
  const conv = await mine(req.params.id, req.user.id)
  requireOwner(conv, req.user)

  const existing = memberIds(conv)
  const fresh = [...new Set(req.body.userIds)].filter((id) => !existing.includes(id))
  if (!fresh.length) throw new HttpError(400, 'Everyone you picked is already in this group')
  if (existing.length + fresh.length > MAX_GROUP_MEMBERS) throw new HttpError(400, `A group can have up to ${MAX_GROUP_MEMBERS} members`)
  const people = await User.find({ _id: { $in: fresh }, active: true }).select('name')
  if (people.length !== fresh.length) throw new HttpError(400, 'Some of the people you picked are not available')

  const now = new Date()
  await Conversation.updateOne({ _id: conv._id }, {
    $push: { members: { $each: people.map((p) => ({ userId: p.id, joinedAt: now, lastReadAt: now })) } },
  })
  const everyone = [...existing, ...fresh]
  changed(conv, everyone)
  await system(conv, everyone, `${req.user.name} added ${people.map((p) => p.name).join(', ')}`)
  res.json(await loadConversationView(conv.id, req.user.id))
}))

// Leave a group (yourself), or remove someone (owner only)
router.delete('/conversations/:id/members/:userId', asyncHandler(async (req, res) => {
  const conv = await mine(req.params.id, req.user.id)
  if (conv.type !== 'group') throw new HttpError(400, 'You can only leave groups')
  const leaving = sameId(req.params.userId, req.user.id)
  if (!leaving) requireOwner(conv, req.user)
  if (!conv.members.some((m) => sameId(m.userId, req.params.userId))) throw new HttpError(404, 'That person is not in this group')

  const remaining = conv.members.filter((m) => !sameId(m.userId, req.params.userId))
  if (!remaining.length) {
    await deleteConversation(conv.id, memberIds(conv)) // the last person left: nothing remains to keep
    return res.status(204).end()
  }

  const update = { $pull: { members: { userId: req.params.userId } } }
  if (sameId(conv.ownerId, req.params.userId)) // the owner left: the longest-standing member takes over
    update.$set = { ownerId: [...remaining].sort((a, b) => a.joinedAt - b.joinedAt)[0].userId }
  await Conversation.updateOne({ _id: conv._id }, update)

  const left = await User.findById(req.params.userId).select('name')
  const rest = memberIds({ members: remaining })
  emitToUsers([req.params.userId], 'conversation:removed', { id: conv.id })
  changed(conv, rest)
  await system(conv, rest, leaving ? `${left?.name ?? 'Someone'} left` : `${req.user.name} removed ${left?.name ?? 'someone'}`)
  res.status(204).end()
}))

router.delete('/conversations/:id', asyncHandler(async (req, res) => {
  const conv = await mine(req.params.id, req.user.id)
  requireOwner(conv, req.user)
  await deleteConversation(conv.id, memberIds(conv))
  res.status(204).end()
}))

export default router
