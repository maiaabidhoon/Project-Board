import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { notify } from '../../lib/store'
import { useAttendanceToday } from '../../lib/hooks'
import { clock } from '../../lib/utils'
import Icon from '../../components/Icon'

// Shared by the "Project Board OTP" chat and the Attendance page.

/** Type today's OTP to mark yourself present. Shows a confirmation once you have. */
export function OtpEntry() {
  const qc = useQueryClient()
  const { data: today } = useAttendanceToday()
  const [otp, setOtp] = useState('')

  const mark = useMutation({
    mutationFn: () => api.markAttendance(otp),
    onSuccess: (r) => {
      notify(r.already ? 'Your attendance was already marked today.' : 'Attendance marked. Have a great day!', 'success')
      setOtp('')
      qc.invalidateQueries({ queryKey: ['attendance'] })
    },
    onError: (e) => { notify(e.message); setOtp('') },
  })

  if (!today) return <p className="px-1 text-sm text-muted">Loading…</p>

  if (today.marked)
    return (
      <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
        <Icon name="check" className="size-4" />Present today · marked at {clock(today.markedAt)}
      </p>
    )

  // Expiry is checked here against the clock too, because this screen may not refetch the moment the OTP runs out
  const active = today.otpSent && new Date(today.expiresAt) > new Date()
  const hint = !today.otpSent ? "Waiting for the admin to send today's OTP."
    : !active ? "Today's OTP has expired. Ask the admin to send a new one."
    : `Enter the 6-digit OTP from the chat. It is valid until ${clock(today.expiresAt)}.`

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (otp.length === 6) mark.mutate() }}>
      <div className="flex items-center gap-2">
        <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit OTP" aria-label="Attendance OTP"
          className="input text-center font-display text-lg tracking-[0.4em] tabular-nums" />
        <button disabled={otp.length !== 6 || mark.isPending} className="btn btn-primary shrink-0">
          <Icon name="check" />{mark.isPending ? 'Checking…' : 'Mark attendance'}
        </button>
      </div>
      <p className="mt-1.5 px-1 text-xs text-muted">{hint}</p>
    </form>
  )
}

const VALID_FOR = [[15, '15 minutes'], [30, '30 minutes'], [60, '1 hour'], [120, '2 hours']]

/** Admin only: generate today's OTP and post it in the "Project Board OTP" chat for everyone. */
export function SendOtp() {
  const qc = useQueryClient()
  const { data: today } = useAttendanceToday()
  const [minutes, setMinutes] = useState(30)
  const live = today?.otpSent && new Date(today.expiresAt) > new Date()

  const send = useMutation({
    mutationFn: () => api.sendOtp(minutes),
    onSuccess: () => {
      notify('OTP sent to everyone in the Project Board OTP chat.', 'success')
      qc.invalidateQueries({ queryKey: ['attendance'] })
    },
    onError: (e) => notify(e.message),
  })

  const submit = () => {
    if (live && !confirm('An OTP is still active. Sending a new one makes the old OTP stop working. Continue?')) return
    send.mutate()
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-iris-soft px-3 py-2.5">
      <span className="flex items-center gap-1.5 text-sm font-medium text-iris"><Icon name="shield" className="size-4" />Admin</span>
      <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} aria-label="OTP validity" className="input w-auto py-2">
        {VALID_FOR.map(([m, label]) => <option key={m} value={m}>Valid for {label}</option>)}
      </select>
      <button onClick={submit} disabled={send.isPending} className="btn btn-primary py-2">
        <Icon name="send" />{send.isPending ? 'Sending…' : live ? 'Send a new OTP' : "Send today's OTP"}
      </button>
      {live && today.code && <span className="ml-auto text-sm text-muted">Live OTP: <b className="font-display tracking-widest text-ink tabular-nums">{today.code}</b></span>}
    </div>
  )
}
