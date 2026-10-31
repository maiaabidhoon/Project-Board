// Bridge between the REST routes and Socket.IO. Routes call emitToUsers() without knowing how sockets work,
// and everything keeps working (just without live push) if the socket server isn't running, e.g. in scripts.
let io = null
const connections = new Map() // userId -> number of open sockets (a person can have several tabs)

export const setIO = (server) => { io = server }

/** Send an event to every open tab of each listed user (each user has a private room, "user:<id>") */
export function emitToUsers(userIds, event, payload) {
  if (!io) return
  for (const id of new Set(userIds.map(String))) io.to(`user:${id}`).emit(event, payload)
}

/** Drop all of a user's sockets, e.g. when they are deactivated or change their password */
export const disconnectUser = (userId) => io?.in(`user:${userId}`).disconnectSockets(true)

export const presence = {
  /** Returns true when this is the user's first open socket (they just came online) */
  add(id) {
    const n = (connections.get(id) ?? 0) + 1
    connections.set(id, n)
    return n === 1
  },
  /** Returns true when the user's last socket closed (they just went offline) */
  remove(id) {
    const n = (connections.get(id) ?? 1) - 1
    if (n > 0) { connections.set(id, n); return false }
    connections.delete(id)
    return true
  },
  list: () => [...connections.keys()],
}
