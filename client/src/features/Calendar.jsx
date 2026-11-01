import { useState } from 'react'
import { useCalendar, useMeetings, useMembers, useProjects } from '../lib/hooks'
import { select } from '../lib/store'
import { clock, dayKey, todayStr } from '../lib/utils'
import Icon from '../components/Icon'

// One month at a glance: task due dates and meetings. Click a day to see everything on it.
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const PRIORITY_DOT = { high: 'bg-red-500', medium: 'bg-amber-500', low: 'bg-slate-400' }

const shift = (month, by) => {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + by, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function Calendar() {
  const today = todayStr()
  const [month, setMonth] = useState(today.slice(0, 7))
  const [picked, setPicked] = useState(today)
  const { data } = useCalendar(month)
  const { data: meetings = [] } = useMeetings()
  const { data: members = [] } = useMembers()
  const { data: projects = [] } = useProjects()

  const [y, m] = month.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7 // blanks before the 1st, with Monday first
  const key = (d) => `${month}-${String(d).padStart(2, '0')}`

  const byDay = {}
  const add = (day, item) => (byDay[day] ??= []).push(item)
  for (const t of data?.tasks ?? []) add(t.dueDate.slice(0, 10), { type: 'task', id: t.id, t })
  for (const mt of meetings) { const day = dayKey(mt.startsAt); if (day.startsWith(month)) add(day, { type: 'meeting', id: mt.id, mt }) }

  const nameOf = (id) => members.find((u) => u.id === id)?.name ?? 'Unassigned'
  const projectOf = (id) => projects.find((p) => p.id === id)?.name ?? ''
  const late = (t) => t.status !== 'done' && t.dueDate.slice(0, 10) < today
  const chosen = (byDay[picked] ?? []).sort((a, b) => (a.type === 'meeting' ? -1 : 1) - (b.type === 'meeting' ? -1 : 1))
  const monthName = new Date(y, m - 1, 1).toLocaleDateString([], { month: 'long', year: 'numeric' })

  return (
    <>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-tight">Calendar</h2>
          <p className="mt-1 text-muted">Task deadlines and meetings, all in one place.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth(shift(month, -1))} aria-label="Previous month" className="btn btn-ghost px-3 py-2"><Icon name="left" /></button>
          <span className="w-40 text-center font-display text-lg font-semibold">{monthName}</span>
          <button onClick={() => setMonth(shift(month, 1))} aria-label="Next month" className="btn btn-ghost px-3 py-2"><Icon name="right" /></button>
          <button onClick={() => { setMonth(today.slice(0, 7)); setPicked(today) }} className="btn btn-ghost px-3 py-2">Today</button>
        </div>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="overflow-x-auto rounded-2xl bg-white p-3">
          <div className="grid min-w-[40rem] grid-cols-7 gap-1">
            {WEEKDAYS.map((d) => <p key={d} className="px-2 py-1 text-xs font-medium text-muted">{d}</p>)}
            {Array.from({ length: lead }, (_, i) => <div key={`b${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = key(i + 1)
              const items = byDay[day] ?? []
              return (
                <button key={day} onClick={() => setPicked(day)} aria-label={`${day}, ${items.length} items`}
                  className={`min-h-24 rounded-xl border p-1.5 text-left transition hover:border-iris/50 ${picked === day ? 'border-iris bg-iris-soft/50' : 'border-line'}`}>
                  <span className={`mb-1 grid size-6 place-items-center rounded-full text-xs font-medium ${day === today ? 'bg-iris text-white' : ''}`}>{i + 1}</span>
                  {items.slice(0, 3).map((it) => it.type === 'meeting'
                    ? <p key={it.id} className="mb-0.5 flex items-center gap-1 truncate rounded bg-sky-50 px-1 text-[11px] text-sky-700"><Icon name="video" className="size-2.5 shrink-0" />{it.mt.title}</p>
                    : <p key={it.id} className={`mb-0.5 flex items-center gap-1 truncate rounded px-1 text-[11px] ${it.t.status === 'done' ? 'bg-emerald-50 text-emerald-700 line-through' : late(it.t) ? 'bg-red-50 text-red-700' : 'bg-canvas'}`}>
                        <span className={`size-1.5 shrink-0 rounded-full ${PRIORITY_DOT[it.t.priority]}`} />{it.t.title}</p>)}
                  {items.length > 3 && <p className="px-1 text-[11px] text-muted">+{items.length - 3} more</p>}
                </button>
              )
            })}
          </div>
          <p className="mt-3 flex flex-wrap gap-4 px-2 text-xs text-muted">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-red-500" />High</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-500" />Medium</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-slate-400" />Low</span>
            <span className="text-red-700">Red background = overdue</span>
          </p>
        </div>

        <section className="rounded-2xl bg-white p-5">
          <h3 className="mb-3 font-display text-lg font-semibold">{new Date(`${picked}T00:00:00`).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
          {chosen.length === 0 && <p className="text-sm text-muted">Nothing scheduled.</p>}
          <ul className="space-y-2">
            {chosen.map((it) => it.type === 'meeting' ? (
              <li key={it.id}>
                <button onClick={() => select({ projectId: 'meetings', taskId: null })} className="w-full rounded-xl bg-sky-50 p-3 text-left text-sm transition hover:bg-sky-100">
                  <p className="flex items-center gap-1.5 font-medium text-sky-800"><Icon name="video" className="size-3.5" />{it.mt.title}</p>
                  <p className="text-xs text-sky-700/80">{clock(it.mt.startsAt)} · {it.mt.durationMin} min</p>
                </button>
              </li>
            ) : (
              <li key={it.id}>
                <button onClick={() => select({ projectId: it.t.projectId, taskId: it.t.id })} className="w-full rounded-xl bg-canvas p-3 text-left text-sm transition hover:bg-iris-soft">
                  <p className="flex items-center gap-2 font-medium"><span className={`size-2 shrink-0 rounded-full ${PRIORITY_DOT[it.t.priority]}`} /><span className={it.t.status === 'done' ? 'line-through opacity-60' : ''}>{it.t.title}</span></p>
                  <p className="mt-0.5 text-xs text-muted">{projectOf(it.t.projectId)} · {nameOf(it.t.assigneeId)}{late(it.t) && <span className="text-red-600"> · overdue</span>}{it.t.status === 'done' && <span className="text-emerald-600"> · done</span>}</p>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}
