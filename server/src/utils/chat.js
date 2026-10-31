import Conversation from '../models/Conversation.js'
import Message from '../models/Message.js'
import { emitToUsers } from './realtime.js'

export const MAX_GROUP_MEMBERS = 50

export const sameId = (a, b) => String(a?._id ?? a) === String(b?._id ?? b)
export const memberIds = (conv) => conv.members.map((m) => String(m.userId?._id ?? m.userId))

export const messageView = (m) => ({
  id: m.id,
  conversationId: String(m.conversationId),
  senderId: m.senderId ? String(m.senderId) : null,
  senderName: m.senderName ?? null,
  text: m.text,
  system: m.system,
  at: m.at,
})

// conv must have members.userId populated (name, role, active)
export const conversationView = (conv, unread = 0) => ({
  id: conv.id,
  type: conv.type,
  name: conv.name ?? null,
  ownerId: conv.ownerId ? String(conv.ownerId) : null,
  members: conv.members
    .filter((m) => m.userId)
    .map((m) => ({ id: m.userId.id, name: m.userId.name, role: m.userId.role, active: m.userId.active })),
  lastMessage: conv.lastMessage?.at
    ? {
        text: conv.lastMessage.text,
        senderId: conv.lastMessage.senderId ? String(conv.lastMessage.senderId) : null,
        senderName: conv.lastMessage.senderName ?? null,
        system: !!conv.lastMessage.system,
        at: conv.lastMessage.at,
      }
    : null,
  lastMessageAt: conv.lastMessageAt,
  unread,
})

const populateMembers = (query) => query.populate('members.userId', 'name role active')

function unreadFor(conv, userId) {
  const me = conv.members.find((m) => sameId(m.userId, userId))
  if (!me) return 0
  return Message.countDocuments(
    { conversationId: conv._id, system: false, senderId: { $ne: userId }, at: { $gt: me.lastReadAt } },
    { limit: 100 },
  )
}

export async function listConversations(userId) {
  const convs = await populateMembers(Conversation.find({ 'members.userId': userId }).sort('-lastMessageAt').limit(200))
  return Promise.all(convs.map(async (c) => conversationView(c, await unreadFor(c, userId))))
}

export async function loadConversationView(id, userId) {
  const conv = await populateMembers(Conversation.findOne({ _id: id, 'members.userId': userId }))
  return conv ? conversationView(conv, await unreadFor(conv, userId)) : null
}

/**
 * Save a message, update the conversation's preview, and push it live to every member.
 * sender is { id, name }, or null for a system message ("Faizul added Arun").
 */
export async function postMessage({ conversationId, recipientIds, sender = null, text, system = false }) {
  const message = await Message.create({
    conversationId,
    senderId: sender?.id ?? null,
    senderName: sender?.name ?? null,
    text: system ? text.slice(0, 500) : text,
    system,
  })
  const preview = {
    lastMessage: { text: message.text.slice(0, 140), senderId: message.senderId, senderName: message.senderName, system, at: message.at },
    lastMessageAt: message.at,
  }
  if (sender) {
    // Your own message counts as read by you
    await Conversation.updateOne({ _id: conversationId, 'members.userId': sender.id }, { $set: { ...preview, 'members.$.lastReadAt': message.at } })
  } else {
    await Conversation.updateOne({ _id: conversationId }, { $set: preview })
  }
  const view = messageView(message)
  emitToUsers(recipientIds, 'message:new', view)
  return view
}

export async function deleteConversation(id, recipientIds) {
  await Promise.all([Conversation.deleteOne({ _id: id }), Message.deleteMany({ conversationId: id })])
  emitToUsers(recipientIds, 'conversation:removed', { id: String(id) })
}

/** When an account is deleted: remove it from every chat, and hand over or delete chats that depended on it */
export async function purgeUserFromChats(userId) {
  const convs = await Conversation.find({ 'members.userId': userId }).select('type ownerId members')
  for (const conv of convs) {
    const remaining = conv.members.filter((m) => !sameId(m.userId, userId))
    if (conv.type === 'dm' || remaining.length === 0) {
      await deleteConversation(conv.id, memberIds(conv).filter((id) => id !== String(userId)))
      continue
    }
    const update = { $pull: { members: { userId } } }
    if (sameId(conv.ownerId, userId)) update.$set = { ownerId: [...remaining].sort((a, b) => a.joinedAt - b.joinedAt)[0].userId }
    await Conversation.updateOne({ _id: conv._id }, update)
    emitToUsers(memberIds({ members: remaining }), 'conversation:changed', { id: conv.id })
  }
}
