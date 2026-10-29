import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useStore } from '@tanstack/react-store'
import { ui, select, notify } from '../lib/store'
import { api } from '../lib/api'
import { useTasks, useAction, usePerms } from '../lib/hooks'
import { COLUMNS, PRIORITIES, PRIORITY_RANK } from '../lib/constants'
import { dueInfo } from '../lib/utils'
import Icon from '../components/Icon'
import TaskCard from './TaskCard'
import TaskPanel from './TaskPanel'
import Activity from './Activity'

const NO_FILTER = { q: '', who: 'all', priority: 'all' }

// projectId is a real project id, or 'mine' for the signed-in user's own tasks across all projects
export default function Board({ projectId, projects, members }) {
  const qc = useQueryClient()
  const mine = projectId === 'mine'
  const key = ['tasks', projectId]
  const refresh = [['tasks'], ['activity'], ['rewards']]
  const { data: tasks = [], isLoading } = useTasks(projectId)
  const taskId = useStore(ui, (s) => s.taskId)
  const { user, can, canOn } = usePerms()
  const canCreate = can('task:create') && !mine
  const anyMove = can('task:move') || can('task:move:own')
  const [title, setTitle] = useState('')
  const [filters, setFilters] = useState(NO_FILTER)
  const [overColumn, setOverColumn] = useState(null)

  const addTask = useAction((t) => api.addTask(projectId, t), refresh)

  // Optimistic move: the card jumps instantly, and rolls back if the server refuses
  const move = useMutation({
    mutationFn: ({ id, status }) => api.updateTask(id, { status }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData(key)
      qc.setQueryData(key, (old = []) => old.map((t) => (t.id === id ? { ...t, status } : t)))
      return { previous }
    },
    onError: (e, _vars, ctx) => { qc.setQueryData(key, ctx.previous); notify(e.message) },
    onSettled: () => refresh.forEach((queryKey) => qc.invalidateQueries({ queryKey })),
  })

  const done = tasks.filter((t) => t.status === 'done').length
  const overdue = tasks.filter((t) => dueInfo(t.dueDate, t.status)?.overdue).length
  const percent = tasks.length ? Math.round((done / tasks.length) * 100) : 0
  const selected = tasks.find((t) => t.id === taskId)

  const { q, who, priority } = filters
  const filtering = q || who !== 'all' || priority !== 'all'
  const visible = tasks.filter((t) =>
    (!q || t.title.toLowerCase().includes(q.toLowerCase())) &&
    (who === 'all' || t.assigneeId === (who === 'me' ? user.id : who)) &&
    (priority === 'all' || t.priority === priority))
  const setFilter = (k) => (e) => setFilters({ ...filters, [k]: e.target.value })

  const drop = (e, status) => {
    e.preventDefault()
    setOverColumn(null)
    const task = tasks.find((t) => t.id === e.dataTransfer.getData('text/plain'))
    if (task && task.status !== status && canOn(task, 'task:move')) move.mutate({ id: task.id, status })
  }

  const emptyText = filtering ? 'No matching tasks' : mine ? 'Nothing here' : anyMove ? 'Drop a task here' : 'Nothing here yet'

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-x-8 gap-y-4">
        <div className="min-w-48 flex-1 sm:max-w-xs">
          <p className="mb-2 flex justify-between text-sm"><span className="text-muted">{done} of {tasks.length} {mine ? 'of your tasks' : 'tasks'} done</span><span className="font-medium">{percent}%</span></p>
          <div className="h-2 overflow-hidden rounded-full bg-ink/10" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${percent}%` }} />
          </div>
        </div>
        {overdue > 0 && <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-600">{overdue} overdue</span>}

        {canCreate && (
          <form onSubmit={(e) => { e.preventDefault(); if (title.trim()) addTask.mutate(title, { onSuccess: () => setTitle('') }) }}
            className="flex min-w-64 flex-1 gap-2 sm:max-w-md">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" aria-label="New task title" className="input" />
            <button className="btn btn-primary shrink-0"><Icon name="plus" />Add task</button>
          </form>
        )}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-56">
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={setFilter('q')} placeholder="Search tasks" aria-label="Search tasks" className="input pl-9" />
        </div>
        {!mine && (
          <select value={who} onChange={setFilter('who')} aria-label="Filter by assignee" className="input w-auto">
            <option value="all">Everyone</option>
            <option value="me">My tasks</option>
            {members.filter((m) => m.id !== user.id).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        )}
        <select value={priority} onChange={setFilter('priority')} aria-label="Filter by priority" className="input w-auto">
          <option value="all">Any priority</option>
          {PRIORITIES.map((p) => <option key={p.key} value={p.key}>{p.label} priority</option>)}
        </select>
        {filtering && <button onClick={() => setFilters(NO_FILTER)} className="btn btn-ghost px-3 py-2">Clear filters</button>}
      </div>

      {isLoading ? <p className="text-muted">Loading tasks…</p> : (
        <div className="grid items-start gap-5 lg:grid-cols-3">
          {COLUMNS.map((col, i) => {
            const items = visible.filter((t) => t.status === col.key).sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
            return (
              <section key={col.key}
                onDragOver={(e) => { if (anyMove) { e.preventDefault(); setOverColumn(col.key) } }}
                onDragLeave={() => setOverColumn(null)}
                onDrop={(e) => anyMove && drop(e, col.key)}
                className={`min-h-40 rounded-2xl p-3 transition ${overColumn === col.key ? 'bg-iris/10 ring-2 ring-iris/40' : 'bg-ink/[0.045]'}`}>
                <h3 className="mb-3 flex items-center gap-2 px-1 text-sm font-medium">
                  <span className={`size-2.5 rounded-full ${col.dot}`} />{col.label}
                  <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs text-muted">{items.length}</span>
                </h3>
                <div className="space-y-2.5">
                  {items.length === 0 && <p className="rounded-xl border border-dashed border-ink/15 p-4 text-center text-sm text-muted">{emptyText}</p>}
                  {items.map((t) => (
                    <TaskCard key={t.id} task={t} assignee={members.find((m) => m.id === t.assigneeId)}
                      project={mine ? projects.find((p) => p.id === t.projectId) : null}
                      canMove={canOn(t, 'task:move')} first={i === 0} last={i === COLUMNS.length - 1}
                      onOpen={() => select({ taskId: t.id })}
                      onMove={(step) => move.mutate({ id: t.id, status: COLUMNS[i + step].key })} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {!mine && <Activity projectId={projectId} members={members} />}
      {selected && <TaskPanel task={selected} members={members} projectId={projectId} />}
    </>
  )
}
