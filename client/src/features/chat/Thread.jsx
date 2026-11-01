import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useStore } from '@tanstack/react-store'
import { api } from '../../lib/api'
import { notify } from '../../lib/store'
import { chat, openConversation, sendMessage, emitTyping, appendMessage, zeroUnread, MESSAGES } from '../../lib/chat'
import { useMessages, usePerms } from '../../lib/hooks'
import { clock, colorFor, convTitle, dayKey, dayLabel, peerOf, timeAgo } from '../../lib/utils'
import ChatAvatar from '../../components/ChatAvatar'
import Icon from '../../components/Icon'
import GroupInfo from './GroupInfo'
import { OtpEntry, SendOtp } from '../attendance/Otp'

const CLUSTER_MS = 5 * 60 * 1000 // messages from one person within 5 minutes read as a single block

// What to say under a person's name. We only claim "Offline" when we are sure: if our own connection is down or the
// online list has not arrived yet, we cannot know, and guessing in either direction would be wrong.
function presenceText({ connected, presenceKnown, peerOnline, seenAt }) {
  if (!connected) return 'Connecting…'
  if (!presenceKnown) return ''
  if (peerOnline) return 'Online'
  return seenAt ? `Offline · last seen ${timeAgo(seenAt)}` : 'Offline'
}

export default function Thread({ conv }) {
  const qc = useQueryClient()
  const { user, can } = usePerms()
  const { data, isLoading, isError } = useMessages(conv.id)
  const connected = useStore(chat, (s) => s.connected)
  const typingNow = useStore(chat, (s) => s.typing[conv.id])
  const peer = conv.type === 'dm' ? peerOf(conv, user.id) : null
  const peerOnline = useStore(chat, (s) => !!peer && !!s.online[peer.id])
  const presenceKnown = useStore(chat, (s) => s.presenceKnown)
  const seenAt = useStore(chat, (s) => (peer && s.lastSeen[peer.id]) || peer?.lastSeenAt || null) // live value beats the one loaded earlier
  const [, setTick] = useState(0)
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 30_000); return () => clearInterval(t) }, []) // keeps "last seen 5 minutes ago" honest
  const [text, setText] = useState('')
  const [info, setInfo] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const scroller = useRef(null)
  const input = useRef(null)
  const stick = useRef(true) // keep following new messages only while scrolled to the bottom
  const anchor = useRef(null) // scroll height before older messages were added, to keep the view in place

  const messages = data?.messages ?? []
  const firstId = messages[0]?.id
  const last = messages.at(-1)

  const nameOf = (m) => conv.members.find((x) => x.id === m.senderId)?.name ?? m.senderName ?? 'Former member'
  const typers = conv.members.filter((m) => typingNow?.[m.id] && m.id !== user.id).map((m) => m.name.split(' ')[0])

  // Stay at the bottom for new messages; keep position when older ones are inserted above
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    if (anchor.current != null) { el.scrollTop += el.scrollHeight - anchor.current; anchor.current = null; return }
    if (stick.current || last?.senderId === user.id) el.scrollTop = el.scrollHeight
  }, [last?.id, firstId, isLoading])

  // Opening a chat (or coming back to the tab) marks it as read
  useEffect(() => {
    const mark = () => {
      if (document.visibilityState !== 'visible' || conv.unread === 0) return
      api.markConversationRead(conv.id).then(() => zeroUnread(qc, conv.id)).catch(() => {})
    }
    mark()
    document.addEventListener('visibilitychange', mark)
    return () => document.removeEventListener('visibilitychange', mark)
  }, [conv.id, conv.unread])

  const send = useMutation({
    mutationFn: (t) => sendMessage(conv.id, t),
    onSuccess: (msg) => appendMessage(qc, msg), // no-op if the live event already added it
    onError: (e, t) => { notify(e.message); setText((cur) => cur || t) },
  })

  const submit = () => {
    const t = text.trim()
    if (!t) return
    setText('')
    if (input.current) input.current.style.height = 'auto'
    stick.current = true
    send.mutate(t)
  }

  const onChange = (e) => {
    setText(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`
    if (e.target.value.trim()) emitTyping(conv.id)
  }

  const loadOlder = async () => {
    setLoadingOlder(true)
    try {
      anchor.current = scroller.current.scrollHeight
      const page = await api.messages(conv.id, firstId)
      qc.setQueryData(MESSAGES(conv.id), (old) => ({ hasMore: page.hasMore, messages: [...page.messages, ...(old?.messages ?? [])] }))
    } catch (e) {
      anchor.current = null
      notify(e.message)
    } finally {
      setLoadingOlder(false)
    }
  }

  const subtitle = typers.length
    ? <span className="text-iris">{conv.type === 'dm' ? 'typing…' : `${typers.join(', ')} typing…`}</span>
    : conv.type === 'dm' ? presenceText({ connected, presenceKnown, peerOnline, seenAt }) : conv.type === 'otp' ? 'Daily attendance · read-only' : `${conv.members.length} members`

  return (
    <>
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <button onClick={() => openConversation(null)} aria-label="Back to chats" className="btn btn-ghost px-2 py-2 md:hidden"><Icon name="left" /></button>
        <ChatAvatar conv={conv} meId={user.id} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-lg leading-tight font-semibold">{convTitle(conv, user.id)}</h3>
          <p className="truncate text-xs text-muted">{subtitle}</p>
        </div>
        {conv.type === 'group' && (
          <button onClick={() => setInfo(true)} aria-label="Group info" title="Group info" className="btn btn-ghost px-2 py-2"><Icon name="info" className="size-5" /></button>
        )}
      </header>

      {!connected && (
        <p className="bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-800">
          {navigator.onLine
            ? 'Reconnecting… messages still send, but may arrive a little slower. Online status is hidden until we are back.'
            : "You're offline. Check your internet connection: messages can't be sent until you're back online."}
        </p>
      )}

      <div ref={scroller} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80 }}
        className="flex-1 overflow-y-auto px-4 py-4">
        {data?.hasMore && (
          <div className="mb-3 text-center">
            <button onClick={loadOlder} disabled={loadingOlder} className="btn btn-ghost px-3 py-1.5 text-sm">{loadingOlder ? 'Loading…' : 'Load earlier messages'}</button>
          </div>
        )}
        {isLoading && <p className="py-10 text-center text-sm text-muted">Loading messages…</p>}
        {isError && <p className="py-10 text-center text-sm text-red-600">Couldn't load messages.</p>}
        {data && messages.length === 0 && <p className="py-10 text-center text-sm text-muted">No messages yet. Say hello!</p>}

        {messages.map((m, i) => {
          const prev = messages[i - 1]
          const newDay = !prev || dayKey(prev.at) !== dayKey(m.at)
          const mine = m.senderId === user.id
          const cluster = newDay || prev.system || m.system || prev.senderId !== m.senderId || new Date(m.at) - new Date(prev.at) > CLUSTER_MS
          return (
            <div key={m.id}>
              {newDay && <p className="my-4 text-center text-xs font-medium text-muted">{dayLabel(m.at)}</p>}
              {m.system ? (
                <p className="my-2 text-center text-xs text-muted">{m.text}</p>
              ) : (
                <div className={`flex ${mine ? 'justify-end' : 'justify-start'} ${cluster ? 'mt-3' : 'mt-0.5'}`}>
                  <div className={`max-w-[80%] min-w-0 rounded-2xl px-3.5 py-2 text-sm ${mine ? 'rounded-br-md bg-iris text-white' : 'rounded-bl-md bg-canvas text-ink'}`}>
                    {conv.type !== 'dm' && !mine && cluster && (
                      <p className="mb-0.5 text-xs font-semibold" style={{ color: colorFor(nameOf(m)) }}>{nameOf(m)}</p>
                    )}
                    <p className="break-words whitespace-pre-wrap">{m.text}</p>
                    <p className={`mt-0.5 text-right text-[10px] ${mine ? 'text-white/65' : 'text-muted'}`}>{clock(m.at)}</p>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {conv.type === 'otp' ? (
        <div className="space-y-3 border-t border-line p-3">
          <OtpEntry />
          {can('attendance:send') && <SendOtp />}
        </div>
      ) : (
        <div className="flex items-end gap-2 border-t border-line p-3">
          <textarea ref={input} value={text} onChange={onChange} rows={1} maxLength={2000} aria-label="Message" placeholder="Write a message…"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit() } }}
            className="input max-h-32 resize-none py-2.5" />
          <button onClick={submit} disabled={!text.trim()} aria-label="Send" className="btn btn-primary px-3.5 py-3"><Icon name="send" /></button>
        </div>
      )}

      {info && <GroupInfo conv={conv} onClose={() => setInfo(false)} />}
    </>
  )
}
