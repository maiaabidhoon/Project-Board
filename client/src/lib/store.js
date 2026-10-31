import { Store } from '@tanstack/store'

// UI state (TanStack Store). Server data lives in TanStack Query.
export const ui = new Store({ projectId: null, taskId: null })
export const select = (patch) => ui.setState((s) => ({ ...s, ...patch }))

// Auth session, persisted so a refresh keeps you signed in
const read = (key) => { try { return JSON.parse(localStorage.getItem(key)) } catch { return null } }
export const auth = new Store({ token: read('token'), user: read('user') })

export function setSession(token, user) {
  localStorage.setItem('token', JSON.stringify(token))
  localStorage.setItem('user', JSON.stringify(user))
  auth.setState(() => ({ token, user }))
}

export function clearSession() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  auth.setState(() => ({ token: null, user: null }))
  assistantChat.setState(() => [])
  select({ projectId: null, taskId: null })
}

// AI assistant conversation (kept while you move between pages, cleared on sign-out)
export const assistantChat = new Store([])

// Toast messages
export const toasts = new Store([])
export function notify(message, kind = 'error') {
  const id = Math.random()
  toasts.setState((t) => [...t, { id, message, kind }])
  setTimeout(() => toasts.setState((t) => t.filter((x) => x.id !== id)), 4500)
}

// Reward celebration: set by the API layer when the signed-in user earns points
export const rewardPopup = new Store(null)
export function celebrate(reward) {
  rewardPopup.setState(() => reward)
  setTimeout(() => rewardPopup.setState((cur) => (cur === reward ? null : cur)), 7000)
}
