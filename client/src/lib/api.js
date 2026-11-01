import { auth, clearSession, celebrate } from './store'

// Leave VITE_API_URL empty in development (Vite proxies /api). Set it when the API lives on another domain, e.g. https://api.example.com
export const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

async function req(path, { method = 'GET', body } = {}) {
  const { token } = auth.state
  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  })
  if (res.status === 401 && token && path !== '/auth/login') clearSession()
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Something went wrong')
  return res.status === 204 ? null : res.json()
}

// The assistant has no limit on how long a conversation can be. We send the most recent messages that fit in a size
// budget (the server also caps request bodies), dropping only the oldest ones from what the model sees.
const CONTEXT_CHARS = 25_000
function recent(messages) {
  const out = []
  let used = 0
  for (let i = messages.length - 1; i >= 0; i--) {
    const { role, content } = messages[i]
    used += content.length
    if (out.length && used > CONTEXT_CHARS) break
    out.unshift({ role, content })
  }
  return out
}

export const api = {
  login: (email, password) => req('/auth/login', { method: 'POST', body: { email, password } }),
  me: () => req('/auth/me'),
  changePassword: (currentPassword, newPassword) => req('/auth/password', { method: 'PATCH', body: { currentPassword, newPassword } }),

  members: () => req('/members'),
  projects: () => req('/projects'),
  addProject: (name) => req('/projects', { method: 'POST', body: { name } }),
  deleteProject: (id) => req(`/projects/${id}`, { method: 'DELETE' }),

  // 'mine' is a pseudo-project: every task assigned to the signed-in user
  tasks: (projectId) => req(projectId === 'mine' ? '/tasks/mine' : `/projects/${projectId}/tasks`),
  activity: (projectId) => req(`/projects/${projectId}/activity`),
  addTask: (projectId, title) => req(`/projects/${projectId}/tasks`, { method: 'POST', body: { title } }),
  updateTask: async (id, patch) => {
    const task = await req(`/tasks/${id}`, { method: 'PATCH', body: patch })
    if (task.reward) celebrate(task.reward) // points earned by the signed-in user
    return task
  },
  saveChecklist: (id, items) => req(`/tasks/${id}/checklist`, { method: 'PUT', body: { items } }),
  deleteTask: (id) => req(`/tasks/${id}`, { method: 'DELETE' }),
  addComment: (id, text) => req(`/tasks/${id}/comments`, { method: 'POST', body: { text } }),

  notifications: () => req('/notifications'),
  markRead: (id) => req(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => req('/notifications/read-all', { method: 'PATCH' }),

  conversations: () => req('/chat/conversations'),
  openDm: (userId) => req('/chat/conversations', { method: 'POST', body: { type: 'dm', userId } }),
  createGroup: (name, memberIds) => req('/chat/conversations', { method: 'POST', body: { type: 'group', name, memberIds } }),
  messages: (id, before) => req(`/chat/conversations/${id}/messages${before ? `?before=${before}` : ''}`),
  sendMessage: (id, text) => req(`/chat/conversations/${id}/messages`, { method: 'POST', body: { text } }),
  markConversationRead: (id) => req(`/chat/conversations/${id}/read`, { method: 'POST' }),
  renameGroup: (id, name) => req(`/chat/conversations/${id}`, { method: 'PATCH', body: { name } }),
  addGroupMembers: (id, userIds) => req(`/chat/conversations/${id}/members`, { method: 'POST', body: { userIds } }),
  removeGroupMember: (id, userId) => req(`/chat/conversations/${id}/members/${userId}`, { method: 'DELETE' }),
  deleteGroup: (id) => req(`/chat/conversations/${id}`, { method: 'DELETE' }),

  meetings: () => req('/meetings'),
  addMeeting: (meeting) => req('/meetings', { method: 'POST', body: meeting }),
  updateMeeting: (id, patch) => req(`/meetings/${id}`, { method: 'PATCH', body: patch }),
  deleteMeeting: (id) => req(`/meetings/${id}`, { method: 'DELETE' }),
  askAssistant: (messages, projectId) => req('/assistant/chat', { method: 'POST', body: { messages: recent(messages), projectId: projectId || null } }),
  attendanceToday: () => req('/attendance/today'),
  attendanceMe: (month) => req(`/attendance/me?month=${month}`),
  attendanceDay: (date) => req(`/attendance/day?date=${date}`),
  attendanceMonth: (month) => req(`/attendance/month?month=${month}`),
  sendOtp: (validMinutes) => req('/attendance/otp', { method: 'POST', body: { validMinutes } }),
  markAttendance: (otp) => req('/attendance/mark', { method: 'POST', body: { otp } }),
  assistantStatus: () => req('/assistant/status'),
  report: () => req('/reports/overview'),

  myRewards: () => req('/rewards/me'),
  leaderboard: () => req('/rewards/leaderboard'),
  exportProject: async (id) => {
    const res = await fetch(`${API_URL}/api/projects/${id}/export`, { headers: { Authorization: `Bearer ${auth.state.token}` } })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Export failed')
    const file = /filename="(.+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'tasks.csv'
    const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(await res.blob()), download: file })
    link.click()
    URL.revokeObjectURL(link.href)
  },

  adminStats: () => req('/admin/stats'),
  adminUsers: () => req('/admin/users'),
  addUser: (user) => req('/admin/users', { method: 'POST', body: user }),
  updateUser: (id, patch) => req(`/admin/users/${id}`, { method: 'PATCH', body: patch }),
  deleteUser: (id) => req(`/admin/users/${id}`, { method: 'DELETE' }),
}
