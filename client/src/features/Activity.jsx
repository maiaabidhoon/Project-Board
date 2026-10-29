import { useActivity } from '../lib/hooks'
import { timeAgo } from '../lib/utils'
import Avatar from '../components/Avatar'

export default function Activity({ projectId, members }) {
  const { data: items = [] } = useActivity(projectId)
  const nameOf = (id) => members.find((m) => m.id === id)?.name ?? 'Former member'

  return (
    <section className="mt-10">
      <h3 className="mb-4 font-display text-lg font-semibold">Recent activity</h3>
      {items.length === 0 ? <p className="text-sm text-muted">Nothing yet. Changes to tasks will show up here.</p> : (
        <ul className="space-y-3 rounded-2xl bg-white p-5">
          {items.map((a) => (
            <li key={a.id} className="flex items-center gap-3 text-sm">
              <Avatar name={nameOf(a.actorId)} />
              <p className="min-w-0 flex-1"><span className="font-medium">{nameOf(a.actorId)}</span> {a.message}</p>
              <time dateTime={a.at} title={new Date(a.at).toLocaleString()} className="shrink-0 text-xs text-muted">{timeAgo(a.at)}</time>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
