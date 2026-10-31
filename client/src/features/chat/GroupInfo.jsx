import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { dropConversation, upsertConversation } from '../../lib/chat'
import { useMembers, useAction, usePerms } from '../../lib/hooks'
import Avatar from '../../components/Avatar'
import Icon from '../../components/Icon'
import Modal from '../../components/Modal'
import { OnlineDot } from '../../components/ChatAvatar'

// Members, rename, add and remove people (owner), leave, delete (owner)
export default function GroupInfo({ conv, onClose }) {
  const qc = useQueryClient()
  const { user } = usePerms()
  const { data: everyone = [] } = useMembers()
  const isOwner = conv.ownerId === user.id
  const [name, setName] = useState(conv.name)
  const [adding, setAdding] = useState(false)
  const [picked, setPicked] = useState([])

  const candidates = everyone.filter((m) => !conv.members.some((x) => x.id === m.id))
  const updated = (next) => upsertConversation(qc, next)
  const gone = () => { dropConversation(qc, conv.id); onClose() }

  const rename = useAction(() => api.renameGroup(conv.id, name))
  const add = useAction(() => api.addGroupMembers(conv.id, picked))
  const remove = useAction((userId) => api.removeGroupMember(conv.id, userId), [['chat', 'conversations']])
  const leave = useAction(() => api.removeGroupMember(conv.id, user.id))
  const destroy = useAction(() => api.deleteGroup(conv.id))

  return (
    <Modal title="Group info" onClose={onClose}>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 pb-6">
        {isOwner ? (
          <form onSubmit={(e) => { e.preventDefault(); if (name.trim() && name.trim() !== conv.name) rename.mutate(undefined, { onSuccess: updated }) }} className="flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-label="Group name" className="input" />
            <button disabled={!name.trim() || name.trim() === conv.name || rename.isPending} className="btn btn-primary">Save</button>
          </form>
        ) : (
          <p className="font-display text-lg font-semibold">{conv.name}</p>
        )}

        <div>
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted">{conv.members.length} members</h3>
            {isOwner && candidates.length > 0 && (
              <button onClick={() => { setAdding(!adding); setPicked([]) }} className="btn btn-ghost gap-1 px-2 py-1 text-sm"><Icon name="plus" />Add people</button>
            )}
          </div>

          {adding && (
            <div className="mb-3 rounded-xl border border-line p-2">
              <ul className="max-h-40 overflow-y-auto">
                {candidates.map((m) => (
                  <li key={m.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-canvas">
                      <input type="checkbox" checked={picked.includes(m.id)} onChange={() => setPicked((p) => (p.includes(m.id) ? p.filter((x) => x !== m.id) : [...p, m.id]))} className="size-4 accent-iris" />
                      <Avatar name={m.name} size="size-7 text-[11px]" />
                      <span className="truncate text-sm">{m.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex justify-end">
                <button disabled={!picked.length || add.isPending} className="btn btn-primary px-3 py-1.5"
                  onClick={() => add.mutate(undefined, { onSuccess: (next) => { updated(next); setAdding(false); setPicked([]) } })}>
                  Add {picked.length || ''}
                </button>
              </div>
            </div>
          )}

          <ul>
            {conv.members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-1.5">
                <span className="relative"><Avatar name={m.name} size="size-9 text-xs" /><OnlineDot userId={m.id} /></span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{m.name}{m.id === user.id && <span className="font-normal text-muted"> (you)</span>}</span>
                {m.id === conv.ownerId && <span className="rounded-full bg-iris-soft px-2 py-0.5 text-xs text-iris">Owner</span>}
                {isOwner && m.id !== user.id && (
                  <button onClick={() => confirm(`Remove ${m.name} from this group?`) && remove.mutate(m.id)} aria-label={`Remove ${m.name}`} className="btn btn-danger px-2 py-1.5"><Icon name="x" /></button>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          <button onClick={() => confirm('Leave this group? You will stop receiving its messages.') && leave.mutate(undefined, { onSuccess: gone })} className="btn btn-danger gap-1.5 px-3 py-2"><Icon name="logout" />Leave group</button>
          {isOwner && (
            <button onClick={() => confirm(`Delete “${conv.name}” and all its messages for everyone?`) && destroy.mutate(undefined, { onSuccess: gone })} className="btn btn-danger gap-1.5 px-3 py-2"><Icon name="trash" />Delete group</button>
          )}
        </div>
      </div>
    </Modal>
  )
}
