import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { select, notify } from '../lib/store'
import { go } from '../lib/router'
import { useNotifications } from '../lib/hooks'
import { timeAgo } from '../lib/utils'
import Icon from './Icon'

const ALIGN = { right: 'right-0', sidebar: 'right-0 md:right-auto md:left-0' }

export default function NotificationBell({ align = 'right' }) {
  const qc = useQueryClient()
  const { data } = useNotifications()
  const [open, setOpen] = useState(false)
  const items = data?.items ?? []
  const unread = data?.unread ?? 0
  const lastUnread = useRef(null)

  // Pop a toast when something new arrives while the app is open
  useEffect(() => {
    if (!data) return
    if (lastUnread.current !== null && data.unread > lastUnread.current && data.items[0]) notify(data.items[0].message, 'success')
    lastUnread.current = data.unread
  }, [data])

  const refresh = () => qc.invalidateQueries({ queryKey: ['notifications'] })
  const markOne = useMutation({ mutationFn: api.markRead, onSuccess: refresh })
  const markAll = useMutation({ mutationFn: api.markAllRead, onSuccess: refresh })

  // Mark as read and jump straight to the task it is about
  const openItem = (n) => {
    if (!n.read) markOne.mutate(n.id)
    if (n.type === 'reward') { select({ projectId: 'rewards', taskId: null }); go('#/') }
    else if (n.projectId) { select({ projectId: n.projectId, taskId: n.taskId ?? null }); go('#/') }
    setOpen(false)
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        className="btn relative px-2 py-2 text-white/70 hover:bg-white/10 hover:text-white">
        <Icon name="bell" className="size-5" />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 grid min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className={`absolute top-full z-40 mt-2 w-80 max-w-[85vw] animate-pop overflow-hidden rounded-2xl bg-white text-ink shadow-2xl ${ALIGN[align]}`}>
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="font-display font-semibold">Notifications</h2>
              <button disabled={!unread} onClick={() => markAll.mutate()} className="text-sm text-iris hover:underline disabled:text-muted disabled:no-underline">Mark all read</button>
            </div>
            <ul className="max-h-96 overflow-y-auto">
              {items.length === 0 && <li className="p-6 text-center text-sm text-muted">You're all caught up.</li>}
              {items.map((n) => (
                <li key={n.id}>
                  <button onClick={() => openItem(n)} className="flex w-full gap-3 border-b border-line/60 px-4 py-3 text-left transition last:border-0 hover:bg-canvas">
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-iris'}`} />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm leading-snug ${n.read ? 'text-muted' : 'font-medium'}`}>{n.message}</span>
                      <span className="mt-0.5 block text-xs text-muted">{timeAgo(n.at)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
