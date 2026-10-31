import { useState } from 'react'
import { useStore } from '@tanstack/react-store'
import { chat, openConversation } from '../../lib/chat'
import { useConversations, usePerms } from '../../lib/hooks'
import { convTitle, firstName, listTime } from '../../lib/utils'
import ChatAvatar from '../../components/ChatAvatar'
import Icon from '../../components/Icon'
import Thread from './Thread'
import NewChat from './NewChat'

function preview(conv, meId) {
  const m = conv.lastMessage
  if (!m) return conv.type === 'group' ? 'No messages yet' : 'Say hello'
  if (m.system) return m.text
  const who = m.senderId === meId ? 'You: ' : conv.type === 'group' ? `${firstName(m.senderName ?? '')}: ` : ''
  return who + m.text
}

function ConversationRow({ conv, meId, active }) {
  const typing = useStore(chat, (s) => Object.keys(s.typing[conv.id] ?? {}).length > 0)
  return (
    <button onClick={() => openConversation(conv.id)} aria-current={active}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${active ? 'bg-iris-soft' : 'hover:bg-canvas'}`}>
      <ChatAvatar conv={conv} meId={meId} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={`truncate text-sm ${conv.unread ? 'font-semibold' : 'font-medium'}`}>{convTitle(conv, meId)}</span>
          {conv.lastMessage && <span className="shrink-0 text-xs text-muted">{listTime(conv.lastMessage.at)}</span>}
        </span>
        <span className="mt-0.5 flex items-center justify-between gap-2">
          <span className={`truncate text-sm ${typing ? 'text-iris' : conv.unread ? 'text-ink' : 'text-muted'}`}>{typing ? 'typing…' : preview(conv, meId)}</span>
          {conv.unread > 0 && (
            <span className="grid min-w-5 shrink-0 place-items-center rounded-full bg-iris px-1.5 py-0.5 text-[11px] font-semibold text-white">{conv.unread > 99 ? '99+' : conv.unread}</span>
          )}
        </span>
      </span>
    </button>
  )
}

export default function Chat() {
  const { user, can } = usePerms()
  const { data: convs = [], isLoading } = useConversations()
  const activeId = useStore(chat, (s) => s.activeId)
  const [dialog, setDialog] = useState(null) // 'dm' | 'group' | null
  const [q, setQ] = useState('')

  const active = convs.find((c) => c.id === activeId)
  const shown = convs.filter((c) => convTitle(c, user.id).toLowerCase().includes(q.trim().toLowerCase()))

  return (
    <div className="flex h-[calc(100vh-2.5rem)] min-h-[28rem] overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-line md:h-[calc(100vh-5rem)]">
      {/* On small screens only one side shows at a time */}
      <section className={`${active ? 'hidden md:flex' : 'flex'} w-full flex-col border-line md:w-80 md:shrink-0 md:border-r`}>
        <div className="flex items-center justify-between px-4 pt-5 pb-3">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Chat</h2>
          <div className="flex gap-1">
            <button onClick={() => setDialog('dm')} aria-label="New message" title="New message" className="btn btn-ghost px-2 py-2"><Icon name="pencil" /></button>
            {can('chat:group:create') && (
              <button onClick={() => setDialog('group')} aria-label="New group" title="New group" className="btn btn-ghost px-2 py-2"><Icon name="users" /></button>
            )}
          </div>
        </div>
        <div className="px-4 pb-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats" aria-label="Search chats" className="input py-2" />
        </div>
        <div className="flex-1 overflow-y-auto border-t border-line/70">
          {isLoading && <p className="p-6 text-center text-sm text-muted">Loading…</p>}
          {!isLoading && convs.length === 0 && (
            <p className="p-6 text-center text-sm text-muted">No conversations yet. Use the buttons above to message a teammate{can('chat:group:create') ? ' or start a group' : ''}.</p>
          )}
          {!isLoading && convs.length > 0 && shown.length === 0 && <p className="p-6 text-center text-sm text-muted">No chats match “{q}”.</p>}
          {shown.map((c) => <ConversationRow key={c.id} conv={c} meId={user.id} active={c.id === activeId} />)}
        </div>
      </section>

      <section className={`${active ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col`}>
        {active ? (
          <Thread key={active.id} conv={active} />
        ) : (
          <div className="grid flex-1 place-items-center p-6 text-center">
            <div>
              <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-iris-soft text-iris"><Icon name="chat" className="size-6" /></span>
              <h3 className="mb-1 font-display text-xl font-semibold">Your messages</h3>
              <p className="text-muted">Pick a conversation, or start a new one.</p>
            </div>
          </div>
        )}
      </section>

      {dialog && <NewChat mode={dialog} onClose={() => setDialog(null)} />}
    </div>
  )
}
