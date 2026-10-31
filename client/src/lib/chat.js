import { io } from 'socket.io-client'
import { Store } from '@tanstack/store'
import { auth, ui, notify } from './store'
import { api } from './api'

// Live chat state. Conversations and messages themselves live in TanStack Query's cache (keys under ['chat']);
// this store only holds what is purely live: which chat is open, the connection, who is online and who is typing.
export const chat = new Store({ activeId: null, connected: false, online: {}, typing: {} })
const patch = (p) => chat.setState((s) => ({ ...s, ...p }))
export const openConversation = (id) => patch({ activeId: id })

let socket = null
const typingTimers = new Map()

// ---- cache helpers (used by the socket handlers and by components) ----
export const CONVERSATIONS = ['chat', 'conversations']
export const MESSAGES = (id) => ['chat', 'messages', id]

export function appendMessage(qc, msg) {
  qc.setQueryData(MESSAGES(msg.conversationId), (old) =>
    !old || old.messages.some((m) => m.id === msg.id) ? old : { ...old, messages: [...old.messages, msg] })
}

export const zeroUnread = (qc, id) =>
  qc.setQueryData(CONVERSATIONS, (old) => old?.map((c) => (c.id === id ? { ...c, unread: 0 } : c)))

export function upsertConversation(qc, conv) {
  qc.setQueryData(CONVERSATIONS, (old = []) =>
    old.some((c) => c.id === conv.id) ? old.map((c) => (c.id === conv.id ? conv : c)) : [conv, ...old])
}

export function dropConversation(qc, id) {
  qc.setQueryData(CONVERSATIONS, (old) => old?.filter((c) => c.id !== id))
  qc.removeQueries({ queryKey: MESSAGES(id) })
  if (chat.state.activeId === id) openConversation(null)
}

// ---- typing indicators: shown for a few seconds after the last "typing" event ----
function hideTyping(conversationId, userId) {
  const key = `${conversationId}:${userId}`
  clearTimeout(typingTimers.get(key))
  typingTimers.delete(key)
  chat.setState((s) => {
    const room = { ...s.typing[conversationId] }
    delete room[userId]
    return { ...s, typing: { ...s.typing, [conversationId]: room } }
  })
}

function showTyping(conversationId, userId) {
  const key = `${conversationId}:${userId}`
  clearTimeout(typingTimers.get(key))
  chat.setState((s) => ({ ...s, typing: { ...s.typing, [conversationId]: { ...s.typing[conversationId], [userId]: true } } }))
  typingTimers.set(key, setTimeout(() => hideTyping(conversationId, userId), 3500))
}

const isViewing = (conversationId) =>
  ui.state.projectId === 'chat' && chat.state.activeId === conversationId && document.visibilityState === 'visible'

// ---- connection ----
export function connectSocket(token, qc) {
  disconnectSocket()
  let firstConnect = true
  const s = (socket = io({ auth: { token } })) // same origin; Vite proxies /socket.io in development

  s.on('connect', () => {
    patch({ connected: true })
    // After a dropped connection we may have missed things, so reload (the very first connect needs nothing)
    if (!firstConnect) qc.invalidateQueries({ queryKey: ['chat'] })
    firstConnect = false
  })
  s.on('disconnect', () => patch({ connected: false, typing: {} }))
  s.on('connect_error', (err) => { if (err.data?.status === 401) s.disconnect() }) // the REST layer signs us out

  s.on('message:new', (msg) => {
    const fromMe = msg.senderId === auth.state.user?.id
    const viewing = isViewing(msg.conversationId)
    if (msg.senderId) hideTyping(msg.conversationId, msg.senderId)

    appendMessage(qc, msg)

    let known = false
    qc.setQueryData(CONVERSATIONS, (old) => {
      const i = old?.findIndex((c) => c.id === msg.conversationId) ?? -1
      if (i < 0) return old
      known = true
      const c = old[i]
      const bump = !fromMe && !viewing && !msg.system
      const next = {
        ...c,
        lastMessage: { text: msg.text.slice(0, 140), senderId: msg.senderId, senderName: msg.senderName, system: msg.system, at: msg.at },
        lastMessageAt: msg.at,
        unread: bump ? c.unread + 1 : c.unread,
      }
      return [next, ...old.filter((_, j) => j !== i)]
    })
    if (!known) qc.invalidateQueries({ queryKey: CONVERSATIONS }) // a brand-new chat we haven't loaded yet

    if (!fromMe && !viewing && !msg.system)
      notify(`${msg.senderName ?? 'New message'}: ${msg.text.length > 80 ? `${msg.text.slice(0, 80)}…` : msg.text}`, 'success')
  })

  s.on('conversation:changed', () => qc.invalidateQueries({ queryKey: CONVERSATIONS }))
  s.on('conversation:removed', ({ id }) => dropConversation(qc, id))
  s.on('conversation:read', ({ conversationId }) => zeroUnread(qc, conversationId))
  s.on('typing', ({ conversationId, userId }) => showTyping(conversationId, userId))
  s.on('presence:list', (ids) => patch({ online: Object.fromEntries(ids.map((id) => [id, true])) }))
  s.on('presence:update', ({ userId, online }) =>
    chat.setState((st) => {
      const next = { ...st.online }
      if (online) next[userId] = true
      else delete next[userId]
      return { ...st, online: next }
    }))
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
  typingTimers.forEach(clearTimeout)
  typingTimers.clear()
  chat.setState(() => ({ activeId: null, connected: false, online: {}, typing: {} }))
}

// ---- sending ----
// Over the socket when connected (the server confirms), otherwise over plain HTTP so a message is never lost
export function sendMessage(conversationId, text) {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) return api.sendMessage(conversationId, text).then(resolve, reject)
    socket.timeout(8000).emit('message:send', { conversationId, text }, (err, res) => {
      if (err) return reject(new Error('The server did not respond. Please try again.'))
      return res.ok ? resolve(res.message) : reject(new Error(res.error))
    })
  })
}

const lastTyping = new Map()
export function emitTyping(conversationId) {
  if (!socket?.connected || Date.now() - (lastTyping.get(conversationId) ?? 0) < 2500) return
  lastTyping.set(conversationId, Date.now())
  socket.emit('typing', { conversationId })
}
