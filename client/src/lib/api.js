import { auth, clearSession, celebrate } from './store'

async function req(path, { method = 'GET', body } = {}) {
  const { token } = auth.state
  const res = await fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  })
  if (res.status === 401 && token && path !== '/auth/login') clearSession()
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Something went wrong')
  return res.status === 204 ? null : res.json()
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

  myRewards: () => req('/rewards/me'),
  leaderboard: () => req('/rewards/leaderboard'),
  exportProject: async (id) => {
    const res = await fetch(`/api/projects/${id}/export`, { headers: { Authorization: `Bearer ${auth.state.token}` } })
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
