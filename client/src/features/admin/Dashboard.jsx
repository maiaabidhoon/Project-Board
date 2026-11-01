import { useDashboard } from '../../lib/hooks'
import { colorFor, timeAgo } from '../../lib/utils'
import Avatar from '../../components/Avatar'
import Icon from '../../components/Icon'

// Admin dashboard. Every chart is plain SVG/CSS, so there is no chart library to install.
const IRIS = '#4f46e5'
const GREEN = '#10b981'
const AMBER = '#fbbf24'
const SLATE = '#cbd5e1'
const RED = '#dc2626'

const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0)
const shortDay = (day) => new Date(`${day}T00:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short' })

function Card({ title, hint, children, className = '' }) {
  return (
    <section className={`rounded-2xl bg-white p-5 ${className}`}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      {children}
    </section>
  )
}

function Kpi({ label, value, sub, tone = 'bg-white', subTone = 'text-muted', alert }) {
  return (
    <div className={`rounded-2xl p-5 ${tone}`}>
      <p className={`font-display text-4xl font-semibold tabular-nums ${alert ? 'text-red-600' : ''}`}>{value}</p>
      <p className={`mt-1 text-sm ${subTone}`}>{label}</p>
      {sub && <p className={`mt-0.5 text-xs ${subTone} opacity-80`}>{sub}</p>}
    </div>
  )
}

// Ring chart: slices are [label, value, color]
function Donut({ slices, centre, caption }) {
  const total = slices.reduce((n, s) => n + s[1], 0)
  const R = 54, C = 2 * Math.PI * R
  let offset = 0
  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 140 140" className="size-36 shrink-0" role="img" aria-label={slices.map(([l, v]) => `${l}: ${v}`).join(', ')}>
        <g transform="rotate(-90 70 70)">
          <circle cx="70" cy="70" r={R} fill="none" stroke="#eef0f7" strokeWidth="18" />
          {total > 0 && slices.map(([label, value, color]) => {
            const len = (value / total) * C
            const el = <circle key={label} cx="70" cy="70" r={R} fill="none" stroke={color} strokeWidth="18" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} />
            offset += len
            return el
          })}
        </g>
        <text x="70" y="68" textAnchor="middle" className="fill-ink font-display text-2xl font-semibold">{centre}</text>
        <text x="70" y="86" textAnchor="middle" className="fill-muted text-[10px]">{caption}</text>
      </svg>
      <ul className="space-y-2 text-sm">
        {slices.map(([label, value, color]) => (
          <li key={label} className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: color }} />{label}<b className="ml-auto pl-4 tabular-nums">{value}</b></li>
        ))}
      </ul>
    </div>
  )
}

// Two lines over the last 14 days
function Trend({ data }) {
  const W = 560, H = 190, L = 28, B = 24, T = 10
  const max = Math.max(4, ...data.flatMap((d) => [d.created, d.completed]))
  const x = (i) => L + (i * (W - L - 8)) / (data.length - 1)
  const y = (v) => T + (1 - v / max) * (H - T - B)
  const line = (key) => data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d[key]).toFixed(1)}`).join(' ')
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f))
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Tasks created and completed over the last 14 days">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - 8} y1={y(t)} y2={y(t)} stroke="#eef0f7" />
            <text x={L - 6} y={y(t) + 3} textAnchor="end" className="fill-muted text-[10px]">{t}</text>
          </g>
        ))}
        <path d={line('created')} fill="none" stroke={IRIS} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <path d={line('completed')} fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <g key={d.day}>
            <circle cx={x(i)} cy={y(d.created)} r="3" fill={IRIS}><title>{`${shortDay(d.day)}: ${d.created} created`}</title></circle>
            <circle cx={x(i)} cy={y(d.completed)} r="3" fill={GREEN}><title>{`${shortDay(d.day)}: ${d.completed} completed`}</title></circle>
            {i % 3 === 0 && <text x={x(i)} y={H - 6} textAnchor="middle" className="fill-muted text-[10px]">{shortDay(d.day)}</text>}
          </g>
        ))}
      </svg>
      <p className="mt-2 flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: IRIS }} />Created</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: GREEN }} />Moved to Done</span>
      </p>
    </>
  )
}

// One bar per day: how many people entered the OTP. Days with no OTP are shown as a faint stub.
function AttendanceBars({ data, total }) {
  const H = 110
  return (
    <>
      <div className="flex items-end gap-1.5" style={{ height: H }} role="img" aria-label="People present each day over the last 14 days">
        {data.map((d) => {
          const h = d.taken ? Math.max(4, (d.present / Math.max(1, total)) * H) : 4
          return (
            <div key={d.day} className="flex flex-1 flex-col justify-end" title={d.taken ? `${shortDay(d.day)}: ${d.present} of ${total} present` : `${shortDay(d.day)}: no OTP sent`}>
              <div className="rounded-t" style={{ height: h, background: d.taken ? IRIS : '#e5e7f0' }} />
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5 text-[10px] text-muted">
        {data.map((d, i) => <span key={d.day} className="flex-1 text-center">{i % 3 === 0 ? shortDay(d.day).split(' ')[0] : ''}</span>)}
      </div>
    </>
  )
}

function Stack({ row, keys }) {
  const total = keys.reduce((n, [k]) => n + row[k], 0)
  return (
    <div className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-canvas">
      {keys.map(([k, color]) => <div key={k} style={{ width: `${pct(row[k], total)}%`, background: color }} />)}
    </div>
  )
}

export default function Dashboard() {
  const { data, isLoading, isError } = useDashboard()
  if (isLoading) return <p className="text-muted">Loading dashboard…</p>
  if (isError || !data) return <p className="text-red-600">Couldn't load the dashboard.</p>

  const { totals: t, status, priority, projects, workload, trend, leaders, recent, roles } = data
  const att = t.attendanceToday
  const STATUS_KEYS = [['done', GREEN], ['doing', AMBER], ['todo', SLATE]]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="Team members" value={t.activeUsers} sub={`${t.online} online now`} tone="bg-iris text-white" subTone="text-white/75" />
        <Kpi label="Open tasks" value={t.open} sub={`${t.done} completed · ${pct(t.done, t.tasks)}% done`} />
        <Kpi label="Overdue" value={t.overdue} sub={t.overdue ? 'Needs attention' : 'All on track'} alert={t.overdue > 0} />
        <Kpi label="Present today" value={att.taken ? `${att.present}/${att.total}` : '—'} sub={att.taken ? `${pct(att.present, att.total)}% attendance` : 'OTP not sent yet'} />
        <Kpi label="Projects" value={t.projects} />
        <Kpi label="Upcoming meetings" value={t.upcomingMeetings} />
        <Kpi label="Chat messages (24h)" value={t.messages24h} />
        <Kpi label="Roles" value={`${roles.admin}/${roles.manager}/${roles.member}`} sub="admins / managers / members" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Task activity" hint="Last 14 days"><Trend data={trend} /></Card>
        <Card title="Attendance" hint="People present per day"><AttendanceBars data={trend} total={att.total} /></Card>

        <Card title="Tasks by status">
          <Donut centre={`${pct(status.done, t.tasks)}%`} caption="done"
            slices={[['Done', status.done, GREEN], ['In progress', status.doing, AMBER], ['To do', status.todo, SLATE]]} />
        </Card>
        <Card title="Open tasks by priority">
          <Donut centre={t.open} caption="open"
            slices={[['High', priority.high, RED], ['Medium', priority.medium, '#d97706'], ['Low', priority.low, '#64748b']]} />
        </Card>

        <Card title="Project progress">
          {projects.length === 0 && <p className="text-sm text-muted">No projects yet.</p>}
          <ul className="space-y-3">
            {projects.map((p) => (
              <li key={p.id}>
                <p className="mb-1 flex justify-between text-sm"><span className="truncate font-medium">{p.name}</span>
                  <span className="text-muted">{p.done}/{p.todo + p.doing + p.done} done{p.overdue > 0 && <span className="text-red-600"> · {p.overdue} overdue</span>}</span></p>
                <div className="flex"><Stack row={p} keys={STATUS_KEYS} /></div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Who is busiest" hint="Open tasks">
          {workload.length === 0 && <p className="text-sm text-muted">No tasks assigned yet.</p>}
          <ul className="space-y-3">
            {workload.map((w) => {
              const top = Math.max(1, ...workload.map((x) => x.open))
              return (
                <li key={w.id} className="flex items-center gap-3 text-sm">
                  <span className="flex w-32 shrink-0 items-center gap-2"><span className="size-2 rounded-full" style={{ background: colorFor(w.name) }} /><span className="truncate">{w.name}</span></span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-canvas"><div className="h-full rounded-full" style={{ width: `${pct(w.open, top)}%`, background: w.overdue ? RED : IRIS }} /></div>
                  <span className={`w-20 text-right text-xs ${w.overdue ? 'text-red-600' : 'text-muted'}`}>{w.open} open{w.overdue ? ` · ${w.overdue} late` : ''}</span>
                </li>
              )
            })}
          </ul>
        </Card>

        <Card title="Top performers" hint="By reward points">
          {leaders.every((l) => l.points === 0) && <p className="text-sm text-muted">No points earned yet.</p>}
          <ol className="space-y-2">
            {leaders.filter((l) => l.points > 0).map((l, i) => (
              <li key={l.id} className="flex items-center gap-3">
                <span className="w-5 text-center text-sm font-semibold text-muted">{i + 1}</span>
                <Avatar name={l.name} size="size-8 text-xs" />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{l.name}</span><span className="text-xs text-muted">{l.level}</span></span>
                <span className="flex items-center gap-1 font-medium tabular-nums"><Icon name="trophy" className="size-3.5 text-amber-500" />{l.points}</span>
              </li>
            ))}
          </ol>
        </Card>

        <Card title="Latest activity">
          {recent.length === 0 && <p className="text-sm text-muted">Nothing has happened yet.</p>}
          <ul className="space-y-3">
            {recent.map((a) => (
              <li key={a.id} className="flex gap-3 text-sm">
                <Avatar name={a.actor} size="size-7 text-[10px]" />
                <p className="min-w-0 flex-1"><b className="font-medium">{a.actor}</b> {a.message}{a.project && <span className="text-muted"> in {a.project}</span>}</p>
                <time dateTime={a.at} className="shrink-0 text-xs text-muted">{timeAgo(a.at)}</time>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
