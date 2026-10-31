const COLORS = ['#4f46e5', '#0891b2', '#c026d3', '#ea580c', '#059669', '#db2777', '#7c3aed', '#ca8a04']

// A stable colour per person, so avatars are recognisable at a glance
export const colorFor = (text = '') => COLORS[[...text].reduce((sum, c) => sum + c.charCodeAt(0), 0) % COLORS.length]

export const initials = (name = '') => name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()

export const firstName = (name = '') => name.split(' ')[0]

export const todayStr = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time

// How a due date should look: label plus colour (red when overdue, amber when close)
export function dueInfo(dueDate, status) {
  if (!dueDate) return null
  const day = dueDate.slice(0, 10)
  const label = new Date(dueDate).toLocaleDateString([], { day: 'numeric', month: 'short', timeZone: 'UTC' })
  if (status === 'done') return { label, tone: 'text-muted' }
  if (day < todayStr()) return { label, tone: 'bg-red-50 text-red-600', overdue: true }
  const soon = new Date(); soon.setDate(soon.getDate() + 2)
  if (day <= soon.toLocaleDateString('en-CA')) return { label, tone: 'bg-amber-50 text-amber-700' }
  return { label, tone: 'bg-canvas text-muted' }
}

export function timeAgo(iso) {
  const s = (Date.now() - new Date(iso)) / 1000
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (s < 60) return 'just now'
  if (s < 3600) return rtf.format(-Math.round(s / 60), 'minute')
  if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour')
  return rtf.format(-Math.round(s / 86400), 'day')
}

// Chat helpers
export const peerOf = (conv, meId) => conv.members.find((m) => m.id !== meId)
export const convTitle = (conv, meId) => (conv.type === 'group' ? conv.name : (peerOf(conv, meId)?.name ?? 'Deleted user'))

export const clock = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
export const dayKey = (iso) => new Date(iso).toLocaleDateString('en-CA')

export function dayLabel(iso) {
  const key = dayKey(iso)
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
  if (key === todayStr()) return 'Today'
  if (key === yesterday.toLocaleDateString('en-CA')) return 'Yesterday'
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
}

// Conversation list: the time for today's messages, the date for older ones
export const listTime = (iso) =>
  dayKey(iso) === todayStr() ? clock(iso) : new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' })
