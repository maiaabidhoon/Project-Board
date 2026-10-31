import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useStore } from '@tanstack/react-store'
import { api } from './api'
import { auth, clearSession, notify } from './store'
import { go } from './router'
import { chat, CONVERSATIONS, MESSAGES } from './chat'

export const useMembers = () => useQuery({ queryKey: ['members'], queryFn: api.members })
export const useProjects = () => useQuery({ queryKey: ['projects'], queryFn: api.projects })
// Polling keeps teammates' changes appearing without a manual refresh
const LIVE = 10_000
export const useTasks = (projectId) =>
  useQuery({ queryKey: ['tasks', projectId], queryFn: () => api.tasks(projectId), enabled: !!projectId, refetchInterval: LIVE })
export const useActivity = (projectId) =>
  useQuery({ queryKey: ['activity', projectId], queryFn: () => api.activity(projectId), enabled: !!projectId, refetchInterval: LIVE })
export const useNotifications = () =>
  useQuery({ queryKey: ['notifications'], queryFn: api.notifications, refetchInterval: 15_000 })
export const useRewards = () =>
  useQuery({ queryKey: ['rewards', 'me'], queryFn: api.myRewards, refetchInterval: 30_000 })
export const useLeaderboard = () =>
  useQuery({ queryKey: ['rewards', 'leaderboard'], queryFn: api.leaderboard, refetchInterval: 30_000 })

// Chat: the socket pushes changes instantly, so polling is only a safety net (faster while the socket is down)
export const useConversations = () => {
  const connected = useStore(chat, (s) => s.connected)
  return useQuery({ queryKey: CONVERSATIONS, queryFn: api.conversations, refetchInterval: connected ? 120_000 : 15_000 })
}
export const useUnreadChats = () => useConversations().data?.reduce((n, c) => n + c.unread, 0) ?? 0
export const useMessages = (id) => {
  const connected = useStore(chat, (s) => s.connected)
  return useQuery({
    queryKey: MESSAGES(id), queryFn: () => api.messages(id), enabled: !!id,
    refetchOnWindowFocus: false, // would reset the scroll position of someone reading older messages
    refetchInterval: connected ? false : 5_000,
  })
}
export const useMeetings = () => useQuery({ queryKey: ['meetings'], queryFn: api.meetings, refetchInterval: 30_000 })
export const useReport = () => useQuery({ queryKey: ['report'], queryFn: api.report, refetchInterval: 30_000 })
export const useAdminUsers = () => useQuery({ queryKey: ['admin', 'users'], queryFn: api.adminUsers })
export const useAdminStats = () => useQuery({ queryKey: ['admin', 'stats'], queryFn: api.adminStats })

/** Role checker: does the signed-in user hold this permission? (list comes from the server) */
export const useCan = (permission) =>
  useStore(auth, (s) => s.user?.permissions?.includes(permission) ?? false)

/**
 * Role checker for the UI. `can('x')` is a general permission; `canOn(task, 'x')` also accepts the
 * ':own' variant when the task is assigned to the signed-in user (this is what limits members to their own work).
 */
export function usePerms() {
  const user = useStore(auth, (s) => s.user)
  const list = user?.permissions ?? []
  const can = (p) => list.includes(p)
  const canOn = (task, p) => can(p) || (can(`${p}:own`) && task.assigneeId === user.id)
  return { user, can, canOn }
}

/** Run a mutation, refetch the given query keys, and toast any error */
export function useAction(fn, keys = []) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => keys.forEach((queryKey) => qc.invalidateQueries({ queryKey })),
    onError: (e) => notify(e.message),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return () => { clearSession(); qc.clear(); go('#/') }
}
