import { useState } from 'react'
import { api } from '../lib/api'
import { useMeetings, useMembers, useProjects, useAction, usePerms } from '../lib/hooks'
import Avatar from '../components/Avatar'
import Icon from '../components/Icon'
import Modal from '../components/Modal'

const fmt = (iso) => new Date(iso).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
const endOf = (m) => new Date(new Date(m.startsAt).getTime() + m.durationMin * 60_000)
const DURATIONS = [15, 30, 45, 60, 90, 120]

// <input type="datetime-local"> wants local time as YYYY-MM-DDTHH:mm; start at the next full hour
function nextHour() {
  const d = new Date(Date.now() + 60 * 60_000)
  d.setMinutes(0, 0, 0)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function NewMeeting({ onClose }) {
  const { user } = usePerms()
  const { data: members = [] } = useMembers()
  const { data: projects = [] } = useProjects()
  const [form, setForm] = useState({ title: '', startsAt: nextHour(), durationMin: 30, location: '', description: '', projectId: '' })
  const [invited, setInvited] = useState([])
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const create = useAction(api.addMeeting, [['meetings']])

  const submit = (e) => {
    e.preventDefault()
    create.mutate(
      { ...form, startsAt: new Date(form.startsAt).toISOString(), durationMin: Number(form.durationMin), projectId: form.projectId || null, attendeeIds: invited },
      { onSuccess: onClose },
    )
  }

  return (
    <Modal title="New meeting" onClose={onClose}>
      <form onSubmit={submit} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 pb-6">
        <input required autoFocus value={form.title} onChange={set('title')} maxLength={100} placeholder="Meeting title" aria-label="Title" className="input" />
        <div className="grid grid-cols-2 gap-3">
          <input required type="datetime-local" value={form.startsAt} onChange={set('startsAt')} aria-label="Start" className="input" />
          <select value={form.durationMin} onChange={set('durationMin')} aria-label="Duration" className="input">
            {DURATIONS.map((d) => <option key={d} value={d}>{d} min</option>)}
          </select>
        </div>
        <input value={form.location} onChange={set('location')} maxLength={200} placeholder="Room or video link (optional)" aria-label="Location" className="input" />
        <select value={form.projectId} onChange={set('projectId')} aria-label="Project" className="input">
          <option value="">No project</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <textarea value={form.description} onChange={set('description')} maxLength={500} rows={2} placeholder="Agenda (optional)" aria-label="Agenda" className="input resize-none" />
        <div>
          <p className="mb-1 text-sm font-medium text-muted">Invite people</p>
          <ul className="max-h-36 overflow-y-auto rounded-xl border border-line p-1">
            {members.filter((m) => m.id !== user.id).map((m) => (
              <li key={m.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-canvas">
                  <input type="checkbox" checked={invited.includes(m.id)} className="size-4 accent-iris"
                    onChange={() => setInvited((p) => (p.includes(m.id) ? p.filter((x) => x !== m.id) : [...p, m.id]))} />
                  <Avatar name={m.name} size="size-7 text-[11px]" /><span className="text-sm">{m.name}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button disabled={create.isPending} className="btn btn-primary">Schedule</button>
        </div>
      </form>
    </Modal>
  )
}

function MeetingCard({ m, past, nameOf, projectName, isOrganizer }) {
  const [editing, setEditing] = useState(false)
  const [notes, setNotes] = useState(m.notes)
  const save = useAction((n) => api.updateMeeting(m.id, { notes: n }), [['meetings']])
  const cancel = useAction(() => api.deleteMeeting(m.id), [['meetings']])
  const people = [m.organizerId, ...m.attendees]

  return (
    <li className={`rounded-2xl bg-white p-5 ${past ? 'opacity-75' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-display text-lg font-semibold">{m.title}</h4>
          <p className="mt-0.5 text-sm text-muted">{fmt(m.startsAt)} – {endOf(m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {m.durationMin} min</p>
          {m.location && (
            <p className="mt-1 truncate text-sm">
              {/^https?:\/\//.test(m.location)
                ? <a href={m.location} target="_blank" rel="noopener noreferrer" className="text-iris hover:underline">Join the call</a>
                : m.location}
            </p>
          )}
          {projectName && <p className="mt-1 text-xs text-muted">Project: {projectName}</p>}
          {m.description && <p className="mt-2 text-sm whitespace-pre-wrap">{m.description}</p>}
        </div>
        {isOrganizer && (
          <button onClick={() => confirm(`Cancel “${m.title}”?`) && cancel.mutate()} aria-label="Cancel meeting" className="btn btn-danger px-2 py-2"><Icon name="trash" /></button>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="flex -space-x-2">{people.slice(0, 6).map((id) => <span key={id} className="rounded-full ring-2 ring-white"><Avatar name={nameOf(id)} /></span>)}</div>
        <span className="text-xs text-muted">{people.length} {people.length === 1 ? 'person' : 'people'} · organized by {isOrganizer ? 'you' : nameOf(m.organizerId)}</span>
      </div>

      {(m.notes || isOrganizer) && (
        <div className="mt-3 border-t border-line pt-3">
          {editing ? (
            <>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} maxLength={3000} aria-label="Meeting notes" className="input resize-y" />
              <div className="mt-2 flex justify-end gap-2">
                <button onClick={() => { setNotes(m.notes); setEditing(false) }} className="btn btn-ghost px-3 py-1.5">Cancel</button>
                <button onClick={() => save.mutate(notes, { onSuccess: () => setEditing(false) })} className="btn btn-primary px-3 py-1.5">Save notes</button>
              </div>
            </>
          ) : (
            <>
              <p className="mb-1 text-xs font-medium text-muted">Notes</p>
              {m.notes ? <p className="text-sm whitespace-pre-wrap">{m.notes}</p> : <p className="text-sm text-muted">No notes yet.</p>}
              {isOrganizer && <button onClick={() => setEditing(true)} className="mt-2 text-sm text-iris hover:underline">{m.notes ? 'Edit notes' : 'Add notes'}</button>}
            </>
          )}
        </div>
      )}
    </li>
  )
}

export default function Meetings() {
  const { user } = usePerms()
  const { data: meetings = [], isLoading } = useMeetings()
  const { data: members = [] } = useMembers()
  const { data: projects = [] } = useProjects()
  const [creating, setCreating] = useState(false)

  const nameOf = (id) => (id === user.id ? user.name : members.find((m) => m.id === id)?.name ?? 'Former member')
  const now = new Date()
  const upcoming = meetings.filter((m) => endOf(m) >= now)
  const past = meetings.filter((m) => endOf(m) < now).reverse().slice(0, 10)

  const list = (items, isPast) => (
    <ul className="space-y-3">
      {items.map((m) => (
        <MeetingCard key={m.id} m={m} past={isPast} nameOf={nameOf} isOrganizer={m.organizerId === user.id}
          projectName={projects.find((p) => p.id === m.projectId)?.name} />
      ))}
    </ul>
  )

  return (
    <>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-tight">Meetings</h2>
          <p className="mt-1 text-muted">Schedule meetings, invite teammates and keep the notes in one place.</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn btn-primary shrink-0 gap-1.5"><Icon name="plus" />New meeting</button>
      </header>

      {isLoading && <p className="text-muted">Loading…</p>}
      {!isLoading && meetings.length === 0 && (
        <div className="grid min-h-60 place-items-center text-center">
          <div>
            <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-iris-soft text-iris"><Icon name="video" className="size-6" /></span>
            <h3 className="mb-1 font-display text-xl font-semibold">No meetings yet</h3>
            <p className="text-muted">Schedule one, or wait for an invite.</p>
          </div>
        </div>
      )}
      {upcoming.length > 0 && <section className="mb-8"><h3 className="mb-3 font-display text-lg font-semibold">Upcoming</h3>{list(upcoming, false)}</section>}
      {past.length > 0 && <section><h3 className="mb-3 font-display text-lg font-semibold">Past</h3>{list(past, true)}</section>}

      {creating && <NewMeeting onClose={() => setCreating(false)} />}
    </>
  )
}
