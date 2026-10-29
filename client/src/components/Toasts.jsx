import { useStore } from '@tanstack/react-store'
import { toasts } from '../lib/store'

export default function Toasts() {
  const items = useStore(toasts)
  return (
    <div aria-live="polite" className="fixed right-4 bottom-4 z-50 flex flex-col gap-2">
      {items.map((t) => (
        <div key={t.id} role="status"
          className={`animate-pop rounded-xl px-4 py-3 text-sm text-white shadow-lg ${t.kind === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          {t.message}
        </div>
      ))}
    </div>
  )
}
