import { useReport } from '../lib/hooks'
import { colorFor } from '../lib/utils'

const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0)

// A single horizontal bar, sized relative to the largest value in its list
function Bar({ label, value, max, color }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-24 shrink-0 capitalize">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-canvas">
        <div className="h-full rounded-full" style={{ width: `${pct(value, max)}%`, background: color }} />
      </div>
      <span className="w-8 text-right tabular-nums text-muted">{value}</span>
    </div>
  )
}

// Done / in progress / to do as one stacked bar
function Stack({ row }) {
  const total = row.todo + row.doing + row.done
  return (
    <div className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-canvas" title={`${row.done} done · ${row.doing} in progress · ${row.todo} to do`}>
      <div className="bg-emerald-500" style={{ width: `${pct(row.done, total)}%` }} />
      <div className="bg-amber-400" style={{ width: `${pct(row.doing, total)}%` }} />
      <div className="bg-slate-300" style={{ width: `${pct(row.todo, total)}%` }} />
    </div>
  )
}

function Card({ title, children }) {
  return <section className="rounded-2xl bg-white p-5"><h3 className="mb-4 font-display text-lg font-semibold">{title}</h3>{children}</section>
}

export default function Reports() {
  const { data, isLoading, isError } = useReport()
  if (isLoading) return <p className="text-muted">Loading reports…</p>
  if (isError || !data) return <p className="text-red-600">Couldn't load the reports.</p>

  const { totals, byStatus, byPriority, assignees, projects, unassigned } = data
  const statusMax = Math.max(1, byStatus.todo, byStatus.doing, byStatus.done)
  const priorityMax = Math.max(1, byPriority.low, byPriority.medium, byPriority.high)
  const stats = [
    ['Total tasks', totals.tasks], ['Completed', `${pct(totals.done, totals.tasks)}%`], ['Overdue', totals.overdue],
    ['Projects', totals.projects], ['Upcoming meetings', totals.upcomingMeetings],
  ]
  const rows = [...assignees, ...(unassigned.todo + unassigned.doing + unassigned.done ? [{ id: 'none', name: 'Unassigned', ...unassigned }] : [])]
    .filter((r) => r.todo + r.doing + r.done > 0)

  return (
    <>
      <header className="mb-6">
        <h2 className="font-display text-3xl font-semibold tracking-tight">Reports</h2>
        <p className="mt-1 text-muted">A snapshot of progress across all projects and teammates.</p>
      </header>

      <dl className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-white p-4">
            <dd className={`font-display text-3xl font-semibold tabular-nums ${label === 'Overdue' && value > 0 ? 'text-red-600' : ''}`}>{value}</dd>
            <dt className="text-sm text-muted">{label}</dt>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Tasks by status">
          <div className="space-y-3">
            <Bar label="To do" value={byStatus.todo} max={statusMax} color="#94a3b8" />
            <Bar label="In progress" value={byStatus.doing} max={statusMax} color="#fbbf24" />
            <Bar label="Done" value={byStatus.done} max={statusMax} color="#10b981" />
          </div>
        </Card>

        <Card title="Tasks by priority">
          <div className="space-y-3">
            <Bar label="High" value={byPriority.high} max={priorityMax} color="#dc2626" />
            <Bar label="Medium" value={byPriority.medium} max={priorityMax} color="#d97706" />
            <Bar label="Low" value={byPriority.low} max={priorityMax} color="#64748b" />
          </div>
        </Card>

        <Card title="Project progress">
          {projects.length === 0 && <p className="text-sm text-muted">No projects yet.</p>}
          <ul className="space-y-3">
            {projects.map((p) => {
              const total = p.todo + p.doing + p.done
              return (
                <li key={p.id}>
                  <div className="mb-1 flex justify-between text-sm"><span className="truncate font-medium">{p.name}</span><span className="text-muted">{p.done}/{total} done{p.overdue > 0 && <span className="text-red-600"> · {p.overdue} overdue</span>}</span></div>
                  <div className="flex"><Stack row={p} /></div>
                </li>
              )
            })}
          </ul>
        </Card>

        <Card title="Workload by person">
          {rows.length === 0 && <p className="text-sm text-muted">No tasks assigned yet.</p>}
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 text-sm">
                <span className="flex w-28 shrink-0 items-center gap-2"><span className="size-2 rounded-full" style={{ background: colorFor(r.name) }} /><span className="truncate">{r.name}</span></span>
                <Stack row={r} />
                <span className={`w-16 text-right text-xs ${r.overdue ? 'text-red-600' : 'text-muted'}`}>{r.overdue ? `${r.overdue} overdue` : `${r.done + r.doing + r.todo} tasks`}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex gap-4 text-xs text-muted">
            <span><i className="mr-1 inline-block size-2 rounded-full bg-emerald-500" />Done</span>
            <span><i className="mr-1 inline-block size-2 rounded-full bg-amber-400" />In progress</span>
            <span><i className="mr-1 inline-block size-2 rounded-full bg-slate-300" />To do</span>
          </p>
        </Card>
      </div>
    </>
  )
}
