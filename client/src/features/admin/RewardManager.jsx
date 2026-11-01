import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { notify } from '../../lib/store'
import { useAdminRewards, useAction } from '../../lib/hooks'
import { timeAgo } from '../../lib/utils'
import Avatar from '../../components/Avatar'
import Icon from '../../components/Icon'

// Admin only: change what tasks are worth, give or take points by hand, and reset someone's rewards.
const KEYS = [['admin'], ['rewards']]
const FIELDS = [['low', 'Low priority task'], ['medium', 'Medium priority task'], ['high', 'High priority task'], ['onTimeBonus', 'On-time bonus']]

function Rules({ rules }) {
  const [form, setForm] = useState(rules)
  useEffect(() => setForm(rules), [rules])
  const save = useAction(api.saveRewardRules, KEYS)
  const dirty = FIELDS.some(([k]) => Number(form[k]) !== rules[k])

  return (
    <section className="rounded-2xl bg-white p-5">
      <h3 className="font-display text-lg font-semibold">Point values</h3>
      <p className="mb-4 text-sm text-muted">What a finished task is worth. Changes apply to tasks completed from now on; points already earned stay as they are.</p>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(Object.fromEntries(FIELDS.map(([k]) => [k, Number(form[k])])), { onSuccess: () => notify('Point values saved.', 'success') }) }}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {FIELDS.map(([key, label]) => (
          <label key={key} className="block text-sm"><span className="mb-1 block text-muted">{label}</span>
            <input type="number" min="0" max="1000" step="1" required value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="input tabular-nums" />
          </label>
        ))}
        <button disabled={!dirty || save.isPending} className="btn btn-primary self-end">{save.isPending ? 'Saving…' : 'Save values'}</button>
      </form>
    </section>
  )
}

function AdjustRow({ person, onDone }) {
  const [points, setPoints] = useState('')
  const [reason, setReason] = useState('')
  const adjust = useAction(api.adjustPoints, KEYS)
  const n = Number(points)

  return (
    <tr className="bg-iris-soft/60">
      <td colSpan={6} className="p-4">
        <form onSubmit={(e) => {
          e.preventDefault()
          adjust.mutate({ userId: person.id, points: n, reason: reason.trim() }, { onSuccess: (r) => { notify(`${person.name} now has ${r.points} points.`, 'success'); onDone() } })
        }} className="flex flex-wrap items-end gap-3">
          <label className="text-sm"><span className="mb-1 block text-muted">Points (use − to take away)</span>
            <input type="number" step="1" required autoFocus value={points} onChange={(e) => setPoints(e.target.value)} placeholder="e.g. 50 or -20" className="input w-44 tabular-nums" />
          </label>
          <div className="flex gap-1.5">
            {[10, 50, -10].map((q) => <button key={q} type="button" onClick={() => setPoints(String(q))} className="btn btn-ghost px-2.5 py-2 text-xs">{q > 0 ? `+${q}` : q}</button>)}
          </div>
          <label className="min-w-56 flex-1 text-sm"><span className="mb-1 block text-muted">Reason (they will see it)</span>
            <input required maxLength={140} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Great client demo" className="input" />
          </label>
          <button disabled={adjust.isPending || !n || !reason.trim()} className="btn btn-primary">{adjust.isPending ? 'Saving…' : n < 0 ? 'Take away' : 'Give points'}</button>
          <button type="button" onClick={onDone} className="btn btn-ghost">Cancel</button>
        </form>
      </td>
    </tr>
  )
}

export default function RewardManager() {
  const { data, isLoading, isError } = useAdminRewards()
  const [adjusting, setAdjusting] = useState(null)
  const reset = useAction(api.resetRewards, KEYS)
  if (isLoading) return <p className="text-muted">Loading rewards…</p>
  if (isError || !data) return <p className="text-red-600">Couldn't load reward management.</p>

  const ranked = [...data.users].sort((a, b) => b.points - a.points)

  return (
    <div className="space-y-6">
      <Rules rules={data.rules} />

      <section>
        <h3 className="mb-3 font-display text-lg font-semibold">Team rewards</h3>
        <div className="overflow-x-auto rounded-2xl bg-white">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <th className="p-4 font-medium">Person</th><th className="p-4 font-medium">Points</th><th className="p-4 font-medium">Done</th>
              <th className="p-4 font-medium">Streak</th><th className="p-4 font-medium">Badges</th><th className="p-4" />
            </tr></thead>
            <tbody>
              {ranked.map((u) => [
                <tr key={u.id} className="border-b border-line last:border-0">
                  <td className="p-4"><div className="flex items-center gap-3"><Avatar name={u.name} size="size-9 text-xs" /><div><p className="font-medium">{u.name}</p><p className="text-xs text-muted">{u.level}</p></div></div></td>
                  <td className="p-4 font-medium tabular-nums">{u.points}</td>
                  <td className="p-4 tabular-nums">{u.completed}<span className="text-muted"> ({u.onTime} on time)</span></td>
                  <td className="p-4 tabular-nums">{u.streak} day{u.streak === 1 ? '' : 's'}</td>
                  <td className="p-4 tabular-nums">{u.badges}</td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setAdjusting(adjusting === u.id ? null : u.id)} className="btn btn-ghost px-3 py-2"><Icon name="plus" />Adjust</button>
                      <button onClick={() => confirm(`Reset ${u.name}'s points, streak and badges to zero? This can't be undone.`) && reset.mutate(u.id, { onSuccess: () => notify(`${u.name}'s rewards were reset.`, 'success') })}
                        disabled={!u.points && !u.badges && !u.streak} className="btn btn-danger px-3 py-2">Reset</button>
                    </div>
                  </td>
                </tr>,
                adjusting === u.id && <AdjustRow key={`${u.id}-adjust`} person={u} onDone={() => setAdjusting(null)} />,
              ])}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="mb-3 font-display text-lg font-semibold">Recent changes by admins</h3>
        {data.adjustments.length === 0 ? <p className="rounded-2xl bg-white p-5 text-sm text-muted">Nothing adjusted by hand yet.</p> : (
          <ul className="divide-y divide-line rounded-2xl bg-white">
            {data.adjustments.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className={`w-14 font-medium tabular-nums ${a.points < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{a.points > 0 ? `+${a.points}` : a.points}</span>
                <span className="min-w-0 flex-1 truncate"><b className="font-medium">{a.user}</b> · {a.reason}<span className="text-muted"> (by {a.by})</span></span>
                <time dateTime={a.at} className="shrink-0 text-xs text-muted">{timeAgo(a.at)}</time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
