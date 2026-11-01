import { useState } from 'react'
import { useAttendanceToday, useAttendanceMe, useAttendanceDay, useAttendanceMonth, useCan } from '../lib/hooks'
import { clock, todayStr } from '../lib/utils'
import { select } from '../lib/store'
import Avatar from '../components/Avatar'
import Icon from '../components/Icon'
import { OtpEntry, SendOtp } from './attendance/Otp'

const dayName = (day) => new Date(`${day}T00:00:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })

export default function Attendance() {
  const canSend = useCan('attendance:send')
  const canView = useCan('attendance:view')
  const { data: today } = useAttendanceToday()
  // Until someone picks a date/month, use "today" as the server sees it (its configured timezone), not the browser's
  const [pickedMonth, setMonth] = useState('')
  const [pickedDate, setDate] = useState('')
  const serverDay = today?.day ?? todayStr()
  const month = pickedMonth || serverDay.slice(0, 7)
  const date = pickedDate || serverDay
  const { data: mine } = useAttendanceMe(month)
  const { data: roster } = useAttendanceDay(date, canView)
  const { data: summary } = useAttendanceMonth(month, canView)

  return (
    <>
      <header className="mb-6">
        <h2 className="font-display text-3xl font-semibold tracking-tight">Attendance</h2>
        <p className="mt-1 text-muted">The admin sends a one-time code in the <button onClick={() => select({ projectId: 'chat', taskId: null })} className="font-medium text-iris hover:underline">Project Board OTP chat</button> each day. Enter it to mark yourself present.</p>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <section className="space-y-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-line md:p-6">
            <h3 className="font-display text-lg font-semibold">Today{today && <span className="ml-2 text-sm font-normal text-muted">{dayName(today.day)}</span>}</h3>
            <OtpEntry />
            {canSend && <SendOtp />}
          </section>

          {canView && (
            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-line md:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-display text-lg font-semibold">
                  Who is in{roster && <span className="ml-2 text-sm font-normal text-muted">{roster.present} of {roster.total} present</span>}
                </h3>
                <input type="date" value={date} max={serverDay} onChange={(e) => setDate(e.target.value)} aria-label="Date" className="input w-auto py-2" />
              </div>
              {roster && !roster.otpSent && <p className="mb-3 rounded-lg bg-canvas px-3 py-2 text-sm text-muted">No OTP was sent on this day, so no attendance was taken.</p>}
              <ul className="divide-y divide-line/70">
                {roster?.people.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2.5">
                    <Avatar name={p.name} size="size-9 text-xs" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                    {p.present
                      ? <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"><Icon name="check" className="size-3.5" />{clock(p.markedAt)}</span>
                      : <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">{roster.otpSent ? 'Absent' : '—'}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-line">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-display text-lg font-semibold">My attendance</h3>
              <input type="month" value={month} max={serverDay.slice(0, 7)} onChange={(e) => setMonth(e.target.value)} aria-label="Month" className="input w-auto py-2" />
            </div>
            {mine && (
              <>
                <p className="mb-3 text-sm text-muted"><b className="text-ink">{mine.days.length}</b> of {mine.daysTaken} day{mine.daysTaken === 1 ? '' : 's'} present</p>
                {mine.days.length === 0
                  ? <p className="rounded-lg bg-canvas px-3 py-2 text-sm text-muted">No attendance marked this month.</p>
                  : <ul className="space-y-1.5">{mine.days.map((d) => (
                      <li key={d.day} className="flex items-center justify-between rounded-lg bg-canvas px-3 py-2 text-sm"><span>{dayName(d.day)}</span><span className="text-muted">{clock(d.markedAt)}</span></li>
                    ))}</ul>}
              </>
            )}
          </section>

          {canView && summary && (
            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-line">
              <h3 className="mb-1 font-display text-lg font-semibold">Month summary</h3>
              <p className="mb-3 text-sm text-muted">Attendance was taken on {summary.daysTaken} day{summary.daysTaken === 1 ? '' : 's'}.</p>
              <ul className="space-y-3">
                {summary.people.map((p) => {
                  const pct = summary.daysTaken ? Math.round((p.days / summary.daysTaken) * 100) : 0
                  return (
                    <li key={p.id}>
                      <p className="mb-1 flex justify-between text-sm"><span className="truncate">{p.name}</span><span className="text-muted tabular-nums">{p.days}/{summary.daysTaken}</span></p>
                      <div className="h-1.5 overflow-hidden rounded-full bg-ink/10"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  )
}
