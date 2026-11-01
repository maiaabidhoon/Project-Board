import { useRewards, useLeaderboard, useRewardRules, usePerms } from '../lib/hooks'
import { BADGE_ICON } from '../lib/constants'
import { colorFor, timeAgo } from '../lib/utils'
import Avatar from '../components/Avatar'
import Icon from '../components/Icon'

const RANK_STYLE = ['bg-amber-100 text-amber-700', 'bg-slate-200 text-slate-600', 'bg-orange-100 text-orange-700']
const rulesList = (r) => [['Low priority task', `+${r.low}`], ['Medium priority task', `+${r.medium}`], ['High priority task', `+${r.high}`], ['Finished on or before the due date', `+${r.onTimeBonus}`]]

export default function Rewards() {
  const { data } = useRewards()
  const { data: board = [] } = useLeaderboard()
  const { data: rules } = useRewardRules()
  const { user } = usePerms()
  if (!data) return <p className="text-muted">Loading rewards…</p>
  const { stats, level, badges, history } = data

  return (
    <>
      <header className="mb-6">
        <h2 className="font-display text-3xl font-semibold tracking-tight">Rewards</h2>
        <p className="mt-1 text-muted">Finish the tasks assigned to you to earn points, badges and streaks.</p>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <section className="rounded-3xl bg-iris p-6 text-white md:p-8">
            <p className="text-sm text-white/70">Level {level.level}</p>
            <h3 className="font-display text-4xl font-semibold">{level.name}</h3>
            <p className="mt-2"><span className="font-display text-3xl font-semibold tabular-nums">{stats.points}</span> points</p>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-valuenow={level.progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${level.progress}%` }} />
            </div>
            <p className="mt-2 text-sm text-white/75">{level.next ? `${level.next.min - stats.points} points to ${level.next.name}` : 'You reached the top level'}</p>

            <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[['Completed', stats.completed], ['On time', stats.onTime], ['Current streak', `${stats.streak} d`], ['Best streak', `${stats.longestStreak} d`]].map(([label, value]) => (
                <div key={label}><dd className="font-display text-2xl font-semibold tabular-nums">{value}</dd><dt className="text-sm text-white/70">{label}</dt></div>
              ))}
            </dl>
          </section>

          <section>
            <h3 className="mb-3 font-display text-lg font-semibold">Badges <span className="text-sm font-normal text-muted">{badges.filter((b) => b.earnedAt).length} of {badges.length}</span></h3>
            <ul className="grid gap-3 sm:grid-cols-2">
              {badges.map((b) => (
                <li key={b.key} className={`flex gap-3 rounded-2xl bg-white p-4 ${b.earnedAt ? '' : 'opacity-50'}`}>
                  <span style={{ background: b.earnedAt ? colorFor(b.key) : '#cbd5e1' }} className="grid size-11 shrink-0 place-items-center rounded-xl text-white">
                    <Icon name={BADGE_ICON[b.key] ?? 'star'} className="size-5" />
                  </span>
                  <div>
                    <p className="font-medium">{b.name}</p>
                    <p className="text-sm text-muted">{b.description}</p>
                    {!b.earnedAt && <p className="mt-0.5 text-xs text-muted">Locked</p>}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="mb-3 font-display text-lg font-semibold">Recent rewards</h3>
            {history.length === 0 ? <p className="rounded-2xl bg-white p-5 text-sm text-muted">No rewards yet. Complete a task assigned to you to earn your first points.</p> : (
              <ul className="divide-y divide-line rounded-2xl bg-white">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <span className="min-w-0 flex-1 truncate">{h.title}{h.onTime && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">On time</span>}</span>
                    <span className="font-medium text-iris tabular-nums">+{h.points}</span>
                    <time dateTime={h.at} className="w-20 text-right text-xs text-muted">{timeAgo(h.at)}</time>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section>
            <h3 className="mb-3 font-display text-lg font-semibold">Leaderboard</h3>
            <ol className="space-y-1 rounded-2xl bg-white p-2">
              {board.map((u, i) => (
                <li key={u.id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${u.id === user.id ? 'bg-iris-soft' : ''}`}>
                  <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${RANK_STYLE[i] ?? 'text-muted'}`}>{i + 1}</span>
                  <Avatar name={u.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{u.name}{u.id === user.id && <span className="ml-1 text-xs font-normal text-muted">(you)</span>}</p>
                    <p className="text-xs text-muted">{u.level} · {u.completed} done</p>
                  </div>
                  <span className="font-medium tabular-nums">{u.points}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-2xl bg-white p-5">
            <h3 className="mb-3 font-display text-lg font-semibold">How to earn points</h3>
            <ul className="space-y-2 text-sm">
              {rulesList(rules ?? { low: 10, medium: 20, high: 30, onTimeBonus: 10 }).map(([rule, pts]) => <li key={rule} className="flex justify-between gap-3"><span>{rule}</span><span className="font-medium text-iris">{pts}</span></li>)}
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-muted">Points go to the person the task is assigned to, once per task. Tasks you created for yourself don't earn points. A streak counts days in a row with at least one finished task.</p>
          </section>
        </div>
      </div>
    </>
  )
}
