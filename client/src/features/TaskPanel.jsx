import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { select } from '../lib/store'
import { useAction, useCan, usePerms } from '../lib/hooks'
import { COLUMNS, PRIORITIES } from '../lib/constants'
import Avatar from '../components/Avatar'
import Icon from '../components/Icon'

const close = () => select({ taskId: null })

export default function TaskPanel({ task, members, projectId }) {
  const canEdit = useCan('task:edit')
  const { canOn } = usePerms()
  const canMove = canOn(task, 'task:move') // members: only their own tasks
  const canDelete = useCan('task:delete')
  const canComment = canOn(task, 'comment:create')
  const [text, setText] = useState('')
  const keys = [['tasks'], ['activity'], ['rewards']]
  const [item, setItem] = useState('')

  const update = useAction((patch) => api.updateTask(task.id, patch), keys)
  const comment = useAction((t) => api.addComment(task.id, t), keys)
  const remove = useAction(() => api.deleteTask(task.id), keys)
  const saveList = useAction((items) => api.saveChecklist(task.id, items), keys)
  const canList = canOn(task, 'task:checklist') // members: their own tasks only
  const items = (task.checklist ?? []).map(({ text, done }) => ({ text, done }))
  const doneCount = items.filter((i) => i.done).length
  const nameOf = (id) => members.find((m) => m.id === id)?.name ?? 'Former member'

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && close()
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-night/40" onClick={close}>
      <aside role="dialog" aria-label="Task details" onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md animate-slide-in flex-col gap-7 overflow-y-auto bg-white p-6 shadow-2xl">
        <header className="flex items-start gap-3">
          <input key={task.title} defaultValue={task.title} readOnly={!canEdit} aria-label="Task title"
            onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== task.title) update.mutate({ title: v }) }}
            className="w-full rounded-lg px-2 py-1 font-display text-2xl leading-tight font-semibold hover:bg-canvas focus:bg-canvas focus:outline-none read-only:hover:bg-transparent" />
          <button onClick={close} aria-label="Close" className="btn btn-ghost px-2 py-2"><Icon name="x" /></button>
        </header>

        {!canMove && <p className="rounded-xl bg-canvas px-4 py-3 text-sm text-muted">View only. Only the person this task is assigned to, a manager or an admin can update it.</p>}

        <div>
          <p className="mb-2 text-sm text-muted">Status</p>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-canvas p-1">
            {COLUMNS.map((c) => (
              <button key={c.key} disabled={!canMove} onClick={() => update.mutate({ status: c.key })}
                className={`rounded-lg py-2 text-sm transition ${task.status === c.key ? 'bg-white font-medium shadow-sm' : 'text-muted hover:text-ink'}`}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm text-muted">Priority
            <select value={task.priority} disabled={!canEdit} onChange={(e) => update.mutate({ priority: e.target.value })} className="input mt-2 text-ink">
              {PRIORITIES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </label>
          <label className="block text-sm text-muted">Due date
            <input type="date" key={task.dueDate} defaultValue={task.dueDate?.slice(0, 10) ?? ''} disabled={!canEdit}
              onChange={(e) => update.mutate({ dueDate: e.target.value || null })} className="input mt-2 text-ink" />
          </label>
        </div>

        {(canEdit || task.description) && (
          <label className="block text-sm text-muted">Description
            <textarea key={task.description} defaultValue={task.description} readOnly={!canEdit} rows={3} maxLength={2000}
              placeholder={canEdit ? 'Add details, links or acceptance criteria' : ''}
              onBlur={(e) => { const v = e.target.value.trim(); if (v !== (task.description ?? '')) update.mutate({ description: v }) }}
              className="input mt-2 resize-y text-ink" />
          </label>
        )}

        <label className="block text-sm text-muted">Assignee
          <select value={task.assigneeId ?? ''} disabled={!canEdit} onChange={(e) => update.mutate({ assigneeId: e.target.value || null })} className="input mt-2 text-ink">
            <option value="">Unassigned</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>

        {(canList || items.length > 0) && (
          <section>
            <div className="mb-3 flex items-center justify-between text-sm text-muted"><h3>Checklist</h3>{items.length > 0 && <span>{doneCount}/{items.length}</span>}</div>
            {items.length > 0 && (
              <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-ink/10">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(doneCount / items.length) * 100}%` }} />
              </div>
            )}
            <ul className="space-y-0.5">
              {items.map((it, i) => (
                <li key={i} className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-canvas">
                  <input type="checkbox" checked={it.done} disabled={!canList} aria-label={it.text}
                    onChange={() => saveList.mutate(items.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))} className="size-4 accent-iris" />
                  <span className={`flex-1 text-sm ${it.done ? 'text-muted line-through' : ''}`}>{it.text}</span>
                  {canList && <button aria-label={`Remove ${it.text}`} onClick={() => saveList.mutate(items.filter((_, j) => j !== i))}
                    className="text-muted opacity-100 hover:text-red-600 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"><Icon name="x" className="size-3.5" /></button>}
                </li>
              ))}
            </ul>
            {canList && items.length < 20 && (
              <form onSubmit={(e) => { e.preventDefault(); if (item.trim()) saveList.mutate([...items, { text: item.trim(), done: false }], { onSuccess: () => setItem('') }) }} className="mt-2 flex gap-2">
                <input value={item} onChange={(e) => setItem(e.target.value)} placeholder="Add a checklist item" aria-label="New checklist item" maxLength={100} className="input" />
                <button className="btn btn-ghost border border-line px-3"><Icon name="plus" /></button>
              </form>
            )}
          </section>
        )}

        <section className="flex-1">
          <h3 className="mb-4 text-sm text-muted">Comments</h3>
          <ul className="space-y-4">
            {task.comments.length === 0 && <li className="text-sm text-muted">No comments yet. Start the conversation.</li>}
            {task.comments.map((c) => (
              <li key={c.id} className="flex gap-3">
                <Avatar name={nameOf(c.authorId)} />
                <div className="min-w-0 rounded-2xl rounded-tl-sm bg-canvas px-3.5 py-2.5 text-sm">
                  <p className="font-medium">{nameOf(c.authorId)} <span className="ml-1 text-xs font-normal text-muted">{new Date(c.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span></p>
                  <p className="mt-0.5 break-words">{c.text}</p>
                </div>
              </li>
            ))}
          </ul>
          {canComment && (
            <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) comment.mutate(text, { onSuccess: () => setText('') }) }} className="mt-5 flex gap-2">
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a comment" aria-label="Comment" className="input" />
              <button className="btn btn-primary">Post</button>
            </form>
          )}
        </section>

        {canDelete && (
          <button onClick={() => remove.mutate(undefined, { onSuccess: close })} className="btn btn-danger gap-2 self-start px-3 py-2"><Icon name="trash" />Delete task</button>
        )}
      </aside>
    </div>
  )
}
