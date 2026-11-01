import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useStore } from '@tanstack/react-store'
import { api } from './api'
import { auth, clearSession, notify } from './store'
import { go } from './router'
import { chat, CONVERSATIONS, MESSAGES } from './chat'

export const useMembers = () => useQuery({ queryKey: ['members'], queryFn: api.members })
export const useProjects = () => useQuery({ queryKey: ['projects'], queryFn: api.projects })
// Teammates' changes arrive instantly through the socket ("sync" events). Polling is only the safety net:
// quick while the socket is down (so the app still feels live), slow while it is connected (so a team behind
// one office IP doesn't flood the API).
const SAFETY_NET = 5 * 60_000
const useLive = (ms) => useStore(chat, (s) => (s.connected ? SAFETY_NET : ms))
const LIVE = 10_000

export const useTasks = (projectId) => {
  const every = useLive(LIVE)
  return useQuery({ queryKey: ['tasks', projectId], queryFn: () => api.tasks(projectId), enabled: !!projectId, refetchInterval: every })
}
export const useActivity = (projectId) => {
  const every = useLive(LIVE)
  return useQuery({ queryKey: ['activity', projectId], queryFn: () => api.activity(projectId), enabled: !!projectId, refetchInterval: every })
}
export const useNotifications = () => {
  const every = useLive(15_000)
  return useQuery({ queryKey: ['notifications'], queryFn: api.notifications, refetchInterval: every })
}
export const useRewards = () => {
  const every = useLive(30_000)
  return useQuery({ queryKey: ['rewards', 'me'], queryFn: api.myRewards, refetchInterval: every })
}
export const useLeaderboard = () => {
  const every = useLive(30_000)
  return useQuery({ queryKey: ['rewards', 'leaderboard'], queryFn: api.leaderboard, refetchInterval: every })
}

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
export const useMeetings = () => {
  const every = useLive(30_000)
  return useQuery({ queryKey: ['meetings'], queryFn: api.meetings, refetchInterval: every })
}
export const useReport = () => {
  const every = useLive(30_000)
  return useQuery({ queryKey: ['report'], queryFn: api.report, refetchInterval: every })
}
export const useAttendanceToday = () => {
  const every = useLive(60_000)
  return useQuery({ queryKey: ['attendance', 'today'], queryFn: () => api.attendanceToday(), refetchInterval: every })
}
export const useAttendanceMe = (month) => useQuery({ queryKey: ['attendance', 'me', month], queryFn: () => api.attendanceMe(month) })
export const useAttendanceDay = (date, enabled) =>
  useQuery({ queryKey: ['attendance', 'day', date], queryFn: () => api.attendanceDay(date), enabled })
export const useAttendanceMonth = (month, enabled) =>
  useQuery({ queryKey: ['attendance', 'month', month], queryFn: () => api.attendanceMonth(month), enabled })
export const useAdminUsers = () => useQuery({ queryKey: ['admin', 'users'], queryFn: api.adminUsers })
export const useDashboard = () => {
  const every = useLive(30_000)
  return useQuery({ queryKey: ['admin', 'dashboard'], queryFn: () => api.adminDashboard(), refetchInterval: every })
}
export const useAdminRewards = () => useQuery({ queryKey: ['admin', 'rewards'], queryFn: () => api.adminRewards() })
export const useRewardRules = () => useQuery({ queryKey: ['rewards', 'rules'], queryFn: () => api.rewardRules(), staleTime: 5 * 60_000 })
export const useAnnouncements = () => useQuery({ queryKey: ['announcements'], queryFn: () => api.announcements() })
export const useCalendar = (month) => useQuery({ queryKey: ['tasks', 'calendar', month], queryFn: () => api.calendar(month) })
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
