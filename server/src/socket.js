import { Server } from 'socket.io'
import { env } from './config/env.js'
import { userFromToken } from './middleware/auth.js'
import { socketMessageSchema } from './schemas.js'
import Conversation from './models/Conversation.js'
import { HttpError } from './utils/HttpError.js'
import { memberIds, postMessage } from './utils/chat.js'
import { emitToUsers, presence, setIO } from './utils/realtime.js'

const OBJECT_ID = /^[a-f\d]{24}$/i

// Allows `max` events per 10 seconds, per connection
const limiter = (max) => {
  let count = 0
  let since = Date.now()
  return () => {
    if (Date.now() - since > 10_000) { since = Date.now(); count = 0 }
    return ++count <= max
  }
}

/**
 * Real-time layer. Clients connect with their login token. Each user gets a private room ("user:<id>"),
 * and the server pushes events to the rooms of everyone who should see them, so a user can never
 * receive a conversation they don't belong to.
 *
 * Server -> client: message:new, conversation:changed, conversation:removed, conversation:read,
 *                   typing, presence:list, presence:update
 * Client -> server: message:send (with acknowledgement), typing
 */
export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.clientOrigin },
    maxHttpBufferSize: 16 * 1024, // messages are short text, so refuse anything big
  })
  setIO(io)

  io.use(async (socket, next) => {
    try {
      socket.data.user = await userFromToken(socket.handshake.auth?.token ?? '')
      next()
    } catch (err) {
      const failure = new Error(err.message)
      failure.data = { status: err.status ?? 500 } // the client stops retrying on 401
      next(failure)
    }
  })

  io.on('connection', (socket) => {
    const { user } = socket.data
    const token = socket.handshake.auth.token
    const allowSend = limiter(30)
    const allowTyping = limiter(20)

    socket.join(`user:${user.id}`)
    socket.emit('presence:list', presence.list())
    if (presence.add(user.id)) socket.broadcast.emit('presence:update', { userId: user.id, online: true })

    socket.on('message:send', async (data, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {}
      try {
        if (!allowSend()) throw new HttpError(429, 'You are sending messages too fast')
        await userFromToken(token) // still signed in, still active, session not revoked?
        const parsed = socketMessageSchema.safeParse(data)
        if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message)

        const conv = await Conversation.findOne({ _id: parsed.data.conversationId, 'members.userId': user.id }).select('members.userId')
        if (!conv) throw new HttpError(404, 'Conversation not found')

        const message = await postMessage({
          conversationId: conv.id, recipientIds: memberIds(conv), sender: { id: user.id, name: user.name }, text: parsed.data.text,
        })
        reply({ ok: true, message })
      } catch (err) {
        if (!err.status) console.error('message:send failed:', err)
        reply({ ok: false, error: err.status ? err.message : 'Could not send your message' })
        if (err.status === 401) socket.disconnect(true)
      }
    })

    socket.on('typing', async (data) => {
      try {
        const id = data?.conversationId
        if (!allowTyping() || typeof id !== 'string' || !OBJECT_ID.test(id)) return
        const conv = await Conversation.findOne({ _id: id, 'members.userId': user.id }).select('members.userId').lean()
        if (conv) emitToUsers(memberIds(conv).filter((m) => m !== user.id), 'typing', { conversationId: id, userId: user.id })
      } catch (err) {
        console.error('typing failed:', err.message)
      }
    })

    socket.on('disconnect', () => {
      if (presence.remove(user.id)) io.emit('presence:update', { userId: user.id, online: false })
    })
  })

  return io
}
