// All reward rules in one place
export const POINTS = { low: 10, medium: 20, high: 30 }
export const ON_TIME_BONUS = 10

export const LEVELS = [
  { name: 'Rookie', min: 0 },
  { name: 'Contributor', min: 100 },
  { name: 'Achiever', min: 300 },
  { name: 'Pro', min: 600 },
  { name: 'Legend', min: 1000 },
]

// stats: { points, completed, onTime, high, longestStreak }
export const BADGES = [
  { key: 'first-step', name: 'First Step', description: 'Complete your first task', check: (s) => s.completed >= 1 },
  { key: 'on-a-roll', name: 'On a Roll', description: 'Complete 5 tasks', check: (s) => s.completed >= 5 },
  { key: 'workhorse', name: 'Workhorse', description: 'Complete 25 tasks', check: (s) => s.completed >= 25 },
  { key: 'punctual', name: 'Punctual', description: 'Finish 5 tasks on or before their due date', check: (s) => s.onTime >= 5 },
  { key: 'high-flyer', name: 'High Flyer', description: 'Complete 3 high-priority tasks', check: (s) => s.high >= 3 },
  { key: 'streak-3', name: 'Hat-trick', description: 'Complete tasks 3 days in a row', check: (s) => s.longestStreak >= 3 },
  { key: 'streak-7', name: 'Unstoppable', description: 'Complete tasks 7 days in a row', check: (s) => s.longestStreak >= 7 },
  { key: 'point-hunter', name: 'Point Hunter', description: 'Earn 500 points', check: (s) => s.points >= 500 },
]

export function levelFor(points) {
  let i = LEVELS.length - 1
  while (LEVELS[i].min > points) i--
  const next = LEVELS[i + 1] ?? null
  const progress = next ? Math.round(((points - LEVELS[i].min) / (next.min - LEVELS[i].min)) * 100) : 100
  return { level: i + 1, name: LEVELS[i].name, min: LEVELS[i].min, next, progress }
}
