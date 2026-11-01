import Project from '../models/Project.js'
import Task from '../models/Task.js'
import User from '../models/User.js'
import Meeting from '../models/Meeting.js'
import { env } from '../config/env.js'
import { startOfToday } from './dates.js'

// "Basic mode" for the AI assistant: answers the common questions straight from the database, with no API key and no cost.
// It is used when OPENAI_API_KEY is not set, and as a fallback when the AI service is unreachable or out of credit.

const DAY = 24 * 60 * 60 * 1000
const MAX_LINES = 8
const RANK = { high: 0, medium: 1, low: 2 }
const has = (text, ...words) => words.some((w) => text.includes(w))
const date = (d) => (d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : 'no due date')
const list = (rows, empty) => (rows.length ? rows.slice(0, MAX_LINES).join('\n') + (rows.length > MAX_LINES ? `\n- …and ${rows.length - MAX_LINES} more` : '') : empty)

export const HELP = [
  'Habibi here, in basic mode. I can answer these:',
  '- "What should I focus on today?"',
  '- "Which tasks are overdue or due soon?"',
  '- "Summarize the status of every project."',
  '- "Draft a short stand-up update for me."',
  '- "What meetings do I have coming up?"',
].join('\n')

export async function localAnswer(user, question, projectId) {
  const q = question.toLowerCase()
  const today = startOfToday()
  const soon = new Date(today.getTime() + 3 * DAY)

  const [projects, people] = await Promise.all([Project.find().select('name').sort('name'), User.find({ active: true }).select('name')])
  const projectName = Object.fromEntries(projects.map((p) => [p.id, p.name]))
  const personName = Object.fromEntries(people.map((p) => [p.id, p.name]))
  const scope = projectId ? { projectId } : {}
  const open = await Task.find({ ...scope, status: { $ne: 'done' } }).select('title status priority dueDate assigneeId projectId')

  const label = (t, withOwner) => {
    const where = projectId ? '' : ` [${projectName[String(t.projectId)] ?? '?'}]`
    const who = withOwner ? ` (${t.assigneeId ? personName[String(t.assigneeId)] ?? 'former member' : 'unassigned'})` : ''
    return `- ${t.title}${where}${who} — ${t.priority} priority, due ${date(t.dueDate)}`
  }
  const byUrgency = (a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity) || RANK[a.priority] - RANK[b.priority]

  // Greetings and "who are you"
  if (/^(hi|hii+|hello|hey|yo|namaste|salam|salaam|hola)\b/.test(q) || /who are you|your name|tum kaun|aap kaun|tera naam|tumhara naam|aapka naam/.test(q))
    return `Hi ${user.name.split(' ')[0]}! I'm Habibi, your project buddy. Ask me what to focus on, what is overdue, or for a project summary.`

  // Overdue / deadlines
  if (has(q, 'overdue', 'late', 'due', 'deadline', 'behind', 'risk')) {
    const overdue = open.filter((t) => t.dueDate && t.dueDate < today).sort(byUrgency)
    const upcoming = open.filter((t) => t.dueDate && t.dueDate >= today && t.dueDate <= soon).sort(byUrgency)
    return [
      `Overdue (${overdue.length}):`, list(overdue.map((t) => label(t, true)), '- Nothing is overdue.'),
      '', `Due in the next 3 days (${upcoming.length}):`, list(upcoming.map((t) => label(t, true)), '- Nothing due soon.'),
    ].join('\n')
  }

  // Stand-up draft
  if (has(q, 'stand-up', 'standup', 'stand up', 'status update', 'daily update')) {
    const finished = await Task.find({ ...scope, assigneeId: user.id, status: 'done', updatedAt: { $gte: new Date(today.getTime() - DAY) } }).select('title')
    const mine = open.filter((t) => String(t.assigneeId) === user.id).sort((a, b) => RANK[a.priority] - RANK[b.priority] || byUrgency(a, b))
    const late = mine.filter((t) => t.dueDate && t.dueDate < today)
    return [
      `Stand-up — ${user.name}`, '',
      'Done recently:', list(finished.map((t) => `- ${t.title}`), '- (nothing finished in the last day)'), '',
      'Working on today:', list(mine.filter((t) => t.status === 'doing').concat(mine.filter((t) => t.status === 'todo')).slice(0, 4).map((t) => `- ${t.title}`), '- (no open tasks assigned)'), '',
      'Blockers:', late.length ? list(late.map((t) => `- Overdue: ${t.title}`), '') : '- None',
    ].join('\n')
  }

  // Meetings
  if (has(q, 'meeting', 'calendar', 'schedule')) {
    const meetings = await Meeting.find({ startsAt: { $gte: new Date() }, $or: [{ organizerId: user.id }, { attendees: user.id }] }).sort('startsAt').limit(MAX_LINES)
    const when = (d) => d.toLocaleString('en-IN', { timeZone: env.timezone, dateStyle: 'medium', timeStyle: 'short' })
    return ['Your upcoming meetings:', list(meetings.map((m) => `- ${m.title} — ${when(m.startsAt)}, ${m.durationMin} min${m.location ? `, ${m.location}` : ''}`), '- No upcoming meetings.')].join('\n')
  }

  // Project summary
  if (has(q, 'summar', 'status', 'progress', 'overview', 'project', 'report')) {
    const rows = await Promise.all((projectId ? projects.filter((p) => p.id === projectId) : projects).map(async (p) => {
      const [todo, doing, done] = await Promise.all(['todo', 'doing', 'done'].map((s) => Task.countDocuments({ projectId: p.id, status: s })))
      const late = open.filter((t) => String(t.projectId) === p.id && t.dueDate && t.dueDate < today).length
      const total = todo + doing + done
      return `- ${p.name}: ${done}/${total} done (${total ? Math.round((done / total) * 100) : 0}%), ${doing} in progress, ${todo} to do${late ? `, ${late} overdue` : ''}`
    }))
    return list(rows, 'There are no projects yet.')
  }

  // Focus / what next (also the default for "what should I work on")
  if (has(q, 'focus', 'today', 'next', 'work on', 'priorit', 'start')) {
    const mine = open.filter((t) => String(t.assigneeId) === user.id)
    const ranked = [...mine].sort((a, b) => {
      const lateA = a.dueDate && a.dueDate < today ? 0 : 1
      const lateB = b.dueDate && b.dueDate < today ? 0 : 1
      return lateA - lateB || RANK[a.priority] - RANK[b.priority] || byUrgency(a, b)
    })
    return ranked.length
      ? ['Here is what I would tackle first (overdue, then high priority, then soonest due):', list(ranked.map((t) => label(t, false)), '')].join('\n')
      : 'You have no open tasks assigned to you right now.'
  }

  return HELP
}
