import { useMemo } from 'react'
import { useStore } from '@tanstack/react-store'
import { rewardPopup } from '../lib/store'
import Icon from './Icon'

const COLORS = ['#ffffff', '#fbbf24', '#34d399', '#f472b6', '#22d3ee']

// Shown when the signed-in user earns points for finishing a task
export default function RewardPopup() {
  const reward = useStore(rewardPopup)
  const confetti = useMemo(() => Array.from({ length: 22 }, (_, i) => ({
    left: `${(i * 47) % 100}%`, delay: `${(i % 7) * 0.07}s`, color: COLORS[i % COLORS.length],
  })), [])
  if (!reward) return null

  return (
    <div role="status" aria-live="polite" className="fixed inset-x-0 bottom-6 z-50 mx-auto w-[min(92vw,22rem)] animate-pop">
      <div className="relative overflow-hidden rounded-3xl bg-iris p-6 text-center text-white shadow-2xl shadow-iris/40">
        {confetti.map((c, i) => (
          <span key={i} className="absolute top-0 size-2 animate-fall rounded-sm motion-reduce:hidden" style={{ left: c.left, animationDelay: c.delay, background: c.color }} />
        ))}
        <button onClick={() => rewardPopup.setState(() => null)} aria-label="Close" className="absolute top-3 right-3 text-white/70 hover:text-white"><Icon name="x" /></button>
        <Icon name="trophy" className="mx-auto mb-2 size-8" />
        <p className="font-display text-5xl font-semibold tabular-nums">+{reward.points}</p>
        <p className="mt-1 text-white/85">points for “{reward.title}”</p>
        {reward.onTime && <p className="mt-1 text-sm text-white/75">On-time bonus included</p>}
        {reward.streak > 1 && <p className="mt-1 text-sm">{reward.streak}-day streak</p>}
        {reward.levelUp && <p className="mt-3 rounded-xl bg-white/15 px-3 py-2 text-sm font-medium">Level up: {reward.levelUp}</p>}
        {reward.badges.map((b) => (
          <p key={b.key} className="mt-2 rounded-xl bg-white/15 px-3 py-2 text-sm">
            <span className="font-medium">Badge unlocked: {b.name}</span><br /><span className="text-white/75">{b.description}</span>
          </p>
        ))}
      </div>
    </div>
  )
}
