import { useState } from 'react'
import { api } from '../lib/api'
import { notify, select } from '../lib/store'
import { useAnnouncements, useAction, usePerms } from '../lib/hooks'
import { timeAgo } from '../lib/utils'
import Avatar from '../components/Avatar'
import Icon from '../components/Icon'

const EMPTY = { title: '', body: '', pinned: false }
const DISMISSED = 'dismissed-announcement'

export default function Announcements() {
  const { user, can } = usePerms()
  const { data: items = [], isLoading } = useAnnouncements()
  const [form, setForm] = useState(EMPTY)
  const keys = [['announcements']]
  const post = useAction(api.postAnnouncement, keys)
  const pin = useAction(api.pinAnnouncement, keys)
  const remove = useAction(api.deleteAnnouncement, keys)

  return (
    <>
      <header className="mb-6">
        <h2 className="font-display text-3xl font-semibold tracking-tight">Announcements</h2>
        <p className="mt-1 text-muted">News for the whole team. Everyone is notified when something new is posted.</p>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_22rem]">
        <section className="space-y-3">
          {isLoading && <p className="text-muted">Loading…</p>}
          {!isLoading && items.length === 0 && <p className="rounded-2xl bg-white p-5 text-sm text-muted">No announcements yet.</p>}
          {items.map((a) => {
            const mine = a.author.id === user.id || user.role === 'admin'
            return (
              <article key={a.id} className={`rounded-2xl bg-white p-5 ${a.pinned ? 'ring-2 ring-iris/30' : ''}`}>
                <div className="flex items-start gap-3">
                  <Avatar name={a.author.name} size="size-9 text-xs" />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-lg font-semibold leading-snug">{a.pinned && <Icon name="flag" className="mr-1.5 inline size-4 text-iris" />}{a.title}</h3>
                    <p className="text-xs text-muted">{a.author.name} · {timeAgo(a.at)}</p>
                  </div>
                  {mine && (
                    <div className="flex gap-1">
                      <button onClick={() => pin.mutate({ id: a.id, pinned: !a.pinned })} className="btn btn-ghost px-2.5 py-1.5 text-xs">{a.pinned ? 'Unpin' : 'Pin'}</button>
                      <button aria-label="Delete announcement" onClick={() => confirm('Delete this announcement?') && remove.mutate(a.id)} className="btn btn-danger px-2 py-1.5"><Icon name="trash" /></button>
                    </div>
                  )}
                </div>
                {a.body && <p className="mt-3 text-sm leading-relaxed break-words whitespace-pre-wrap">{a.body}</p>}
              </article>
            )
          })}
        </section>

        {can('announcement:post') && (
          <form onSubmit={(e) => { e.preventDefault(); post.mutate(form, { onSuccess: () => { setForm(EMPTY); notify('Announcement posted.', 'success') } }) }}
            className="space-y-3 rounded-2xl bg-white p-5">
            <h3 className="font-display text-lg font-semibold">Post an announcement</h3>
            <input required maxLength={100} placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" />
            <textarea rows={5} maxLength={1500} placeholder="Details (optional)" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="input resize-y" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} />Pin to the top</label>
            <button disabled={post.isPending || !form.title.trim()} className="btn btn-primary w-full"><Icon name="megaphone" />{post.isPending ? 'Posting…' : 'Post to everyone'}</button>
          </form>
        )}
      </div>
    </>
  )
}

/** Slim strip at the top of the workspace for the newest announcement (pinned ones always, others for 3 days). */
export function AnnouncementBanner() {
  const { data: items = [] } = useAnnouncements()
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem(DISMISSED) } catch { return null } })
  const fresh = items.find((a) => a.pinned || Date.now() - new Date(a.at).getTime() < 3 * 24 * 60 * 60 * 1000)
  if (!fresh || fresh.id === dismissed) return null

  const dismiss = () => { setDismissed(fresh.id); try { localStorage.setItem(DISMISSED, fresh.id) } catch { /* private mode: it just comes back next time */ } }
  return (
    <div className="mb-6 flex items-center gap-3 rounded-2xl bg-iris-soft px-4 py-3 text-sm text-iris">
      <Icon name="megaphone" className="size-4 shrink-0" />
      <button onClick={() => select({ projectId: 'announcements', taskId: null })} className="min-w-0 flex-1 truncate text-left font-medium hover:underline">
        {fresh.title}<span className="font-normal text-iris/70"> · {fresh.author.name}</span>
      </button>
      <button onClick={dismiss} aria-label="Dismiss announcement" className="rounded p-1 hover:bg-white/60"><Icon name="x" /></button>
    </div>
  )
}
