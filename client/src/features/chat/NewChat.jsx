import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { openConversation, upsertConversation } from '../../lib/chat'
import { useMembers, useAction, usePerms } from '../../lib/hooks'
import { ROLE_STYLE } from '../../lib/constants'
import Avatar from '../../components/Avatar'
import Modal from '../../components/Modal'
import { OnlineDot } from '../../components/ChatAvatar'

// Start a direct message, or create a group
export default function NewChat({ mode: initialMode, onClose }) {
  const qc = useQueryClient()
  const { user, can } = usePerms()
  const { data: members = [] } = useMembers()
  const [mode, setMode] = useState(initialMode)
  const [name, setName] = useState('')
  const [picked, setPicked] = useState([])
  const [q, setQ] = useState('')

  const people = members.filter((m) => m.id !== user.id && m.name.toLowerCase().includes(q.trim().toLowerCase()))
  const group = mode === 'group'

  const opened = (conv) => { upsertConversation(qc, conv); openConversation(conv.id); onClose() }
  const openDm = useAction(api.openDm)
  const createGroup = useAction(() => api.createGroup(name, picked))

  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const submit = (e) => {
    e.preventDefault()
    if (group && name.trim() && picked.length) createGroup.mutate(undefined, { onSuccess: opened })
  }

  return (
    <Modal title={group ? 'New group' : 'New message'} onClose={onClose}>
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        {can('chat:group:create') && (
          <div className="mx-6 mb-3 flex rounded-xl bg-canvas p-1 text-sm">
            {[['dm', 'Direct message'], ['group', 'Group']].map(([key, label]) => (
              <button key={key} type="button" onClick={() => setMode(key)}
                className={`flex-1 rounded-lg py-1.5 transition ${mode === key ? 'bg-white font-medium shadow-sm' : 'text-muted hover:text-ink'}`}>{label}</button>
            ))}
          </div>
        )}

        <div className="space-y-3 px-6">
          {group && <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Group name" aria-label="Group name" className="input" />}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" aria-label="Search people" className="input" />
        </div>

        <ul className="mt-3 min-h-40 flex-1 overflow-y-auto border-t border-line/70 px-3 py-2">
          {people.length === 0 && <li className="p-4 text-center text-sm text-muted">No one found.</li>}
          {people.map((m) => (
            <li key={m.id}>
              <button type="button" disabled={openDm.isPending} onClick={() => (group ? toggle(m.id) : openDm.mutate(m.id, { onSuccess: opened }))}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-canvas">
                <span className="relative"><Avatar name={m.name} size="size-9 text-xs" /><OnlineDot userId={m.id} /></span>
                <span className="flex-1 truncate text-sm font-medium">{m.name}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${ROLE_STYLE[m.role]}`}>{m.role}</span>
                {group && <input type="checkbox" readOnly checked={picked.includes(m.id)} tabIndex={-1} className="size-4 accent-iris" aria-label={`Select ${m.name}`} />}
              </button>
            </li>
          ))}
        </ul>

        {group && (
          <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-4">
            <span className="text-sm text-muted">{picked.length} selected</span>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
              <button disabled={!name.trim() || !picked.length || createGroup.isPending} className="btn btn-primary">Create group</button>
            </div>
          </div>
        )}
      </form>
    </Modal>
  )
}
