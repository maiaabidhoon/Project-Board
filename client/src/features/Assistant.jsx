import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useStore } from '@tanstack/react-store'
import { api } from '../lib/api'
import { assistantChat, notify } from '../lib/store'
import { useProjects } from '../lib/hooks'
import Icon from '../components/Icon'

const SUGGESTIONS = [
  'What should I focus on today?',
  'Which tasks are overdue or due soon?',
  'Summarize the status of every project.',
  'Draft a short stand-up update for me.',
]

export default function Assistant() {
  const messages = useStore(assistantChat)
  const { data: projects = [] } = useProjects()
  const [text, setText] = useState('')
  const [projectId, setProjectId] = useState('')
  const [fellBack, setFellBack] = useState(false) // the last answer came from basic mode because the AI service failed
  const end = useRef(null)
  const { data: status } = useQuery({ queryKey: ['assistant', 'status'], queryFn: api.assistantStatus, staleTime: 5 * 60_000 })
  const basic = status ? !status.ai : false

  const ask = useMutation({
    mutationFn: (history) => api.askAssistant(history, projectId),
    onSuccess: ({ reply, fallback }) => {
      setFellBack(Boolean(fallback))
      assistantChat.setState((m) => [...m, { role: 'assistant', content: reply }])
    },
    onError: (e, history) => {
      // Take the question back out so the person can edit it and try again
      assistantChat.setState((m) => m.slice(0, history.length - 1))
      setText((cur) => cur || history.at(-1).content)
      notify(e.message)
    },
  })

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [messages.length, ask.isPending])

  const send = (question) => {
    const content = (question ?? text).trim()
    if (!content || ask.isPending) return
    const history = [...messages, { role: 'user', content }]
    assistantChat.setState(() => history)
    setText('')
    ask.mutate(history)
  }

  return (
    <div className="flex h-[calc(100vh-2.5rem)] min-h-[28rem] flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-line md:h-[calc(100vh-5rem)]">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
        <span className="grid size-10 place-items-center rounded-xl bg-iris-soft text-iris"><Icon name="sparkles" className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold leading-tight">AI Project Assistant</h2>
          <p className="text-xs text-muted">Answers from your team's projects, tasks and meetings. It can't change anything.</p>
        </div>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Focus project" className="input w-auto max-w-48 py-2">
          <option value="">All projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {messages.length > 0 && (
          <button onClick={() => assistantChat.setState(() => [])} disabled={ask.isPending} className="btn btn-ghost px-3 py-2">New chat</button>
        )}
      </header>

      {(basic || fellBack) && (
        <p className="border-b border-line bg-amber-50 px-5 py-2 text-xs text-amber-800">
          {basic
            ? 'Basic mode: answers come straight from your project data. An admin can add OPENAI_API_KEY to server/.env for full AI answers.'
            : 'The AI service is unavailable right now, so this answer came from basic mode.'}
        </p>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.length === 0 && (
          <div className="mx-auto max-w-md py-8 text-center">
            <h3 className="mb-1 font-display text-lg font-semibold">How can I help?</h3>
            <p className="mb-5 text-sm text-muted">Ask about your work, or try one of these.</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border border-line px-3.5 py-2 text-sm transition hover:border-iris hover:bg-iris-soft hover:text-iris">{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <p className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm break-words whitespace-pre-wrap ${m.role === 'user' ? 'rounded-br-md bg-iris text-white' : 'rounded-bl-md bg-canvas text-ink'}`}>{m.content}</p>
          </div>
        ))}
        {ask.isPending && <p className="w-fit animate-pulse rounded-2xl rounded-bl-md bg-canvas px-4 py-2.5 text-sm text-muted">Thinking…</p>}
        <div ref={end} />
      </div>

      <div className="flex items-end gap-2 border-t border-line p-3">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={2000} aria-label="Ask the assistant" placeholder="Ask about your projects and tasks…"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() } }}
          className="input max-h-32 resize-none py-2.5" />
        <button onClick={() => send()} disabled={!text.trim() || ask.isPending} aria-label="Send" className="btn btn-primary px-3.5 py-3"><Icon name="send" /></button>
      </div>
    </div>
  )
}
