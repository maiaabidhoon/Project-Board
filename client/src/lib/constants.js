export const COLUMNS = [
  { key: 'todo', label: 'To do', dot: 'bg-slate-400' },
  { key: 'doing', label: 'In progress', dot: 'bg-amber-400' },
  { key: 'done', label: 'Done', dot: 'bg-emerald-500' },
]

export const PRIORITIES = [
  { key: 'low', label: 'Low', tone: 'text-slate-500' },
  { key: 'medium', label: 'Medium', tone: 'text-amber-600' },
  { key: 'high', label: 'High', tone: 'text-red-600' },
]
export const PRIORITY_RANK = { high: 0, medium: 1, low: 2 }

export const BADGE_ICON = {
  'first-step': 'check', 'on-a-roll': 'flame', workhorse: 'zap', punctual: 'calendar',
  'high-flyer': 'flag', 'streak-3': 'flame', 'streak-7': 'flame', 'point-hunter': 'star',
}

export const ROLES = ['admin', 'manager', 'member']

export const ROLE_STYLE = {
  admin: 'bg-iris-soft text-iris',
  manager: 'bg-amber-100 text-amber-800',
  member: 'bg-slate-100 text-slate-600',
}
