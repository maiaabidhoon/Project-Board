import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useStore } from '@tanstack/react-store'
import { api } from '../lib/api'
import { assistantChat, notify } from '../lib/store'
import { useProjects } from '../lib/hooks'
import { LANGUAGES, canListen, canSpeak, speak, stopSpeaking, useListen } from '../lib/voice'
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
  const [voice, setVoice] = useState(false) // hands-free voice chat: you talk, Habibi answers out loud, then listens again
  const [lang, setLang] = useState(() => localStorage.getItem('habibi-lang') || 'en-IN')
  const [speakingAt, setSpeakingAt] = useState(null) // index of the answer being read aloud
  const end = useRef(null)
  const { data: status } = useQuery({ queryKey: ['assistant', 'status'], queryFn: api.assistantStatus, staleTime: 5 * 60_000 })
  const basic = status ? !status.ai : false

  // Callbacks run later (after a network call, after speech ends), so they read the latest values through refs
  const voiceRef = useRef(false); voiceRef.current = voice
  const langRef = useRef(lang); langRef.current = lang
  const sendRef = useRef(null)

  const listen = useListen({
    lang,
    onFinal: (heard) => (voiceRef.current ? sendRef.current(heard) : setText((cur) => (cur ? `${cur} ${heard}` : heard))),
  })
  const listenRef = useRef(listen); listenRef.current = listen

  const sayThenListen = (reply) =>
    speak(reply, { lang: langRef.current, onEnd: () => { setSpeakingAt(null); if (voiceRef.current) listenRef.current.start() } })

  const ask = useMutation({
    mutationFn: (history) => api.askAssistant(history, projectId),
    onSuccess: ({ reply, fallback }) => {
      setFellBack(Boolean(fallback))
      assistantChat.setState((m) => [...m, { role: 'assistant', content: reply }])
      if (voiceRef.current) { setSpeakingAt(assistantChat.state.length - 1); sayThenListen(reply) }
    },
    onError: (e, history) => {
      // Take the question back out so the person can edit it and try again
      assistantChat.setState((m) => m.slice(0, history.length - 1))
      setText((cur) => cur || history.at(-1).content)
      notify(e.message)
    },
  })

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [messages.length, ask.isPending])
  useEffect(() => () => stopSpeaking(), []) // be quiet when leaving this screen

  const send = (question) => {
    const content = (question ?? text).trim()
    if (!content || ask.isPending) return
    const history = [...messages, { role: 'user', content }]
    assistantChat.setState(() => history)
    setText('')
    ask.mutate(history)
  }
  sendRef.current = send

  const toggleVoice = () => {
    if (voice) {
      setVoice(false); voiceRef.current = false
      stopSpeaking(); setSpeakingAt(null); listen.abort()
    } else {
      setVoice(true); voiceRef.current = true
      listen.start()
    }
  }

  const changeLang = (value) => { setLang(value); localStorage.setItem('habibi-lang', value); stopSpeaking(); listen.abort() }

  const readAloud = (i, content) => {
    if (speakingAt === i) { stopSpeaking(); setSpeakingAt(null); return }
    setSpeakingAt(i)
    speak(content, { lang, onEnd: () => setSpeakingAt(null) })
  }

  // The one big button of voice chat does whatever makes sense next
  const speaking = speakingAt !== null
  const state = ask.isPending ? 'thinking' : listen.listening ? 'listening' : speaking ? 'speaking' : 'idle'
  const press = () => {
    if (state === 'listening') listen.stop() // done talking: send it now
    else if (state === 'speaking') { stopSpeaking(); setSpeakingAt(null); listen.start() } // interrupt and take a turn
    else if (state === 'idle') listen.start()
  }
  const LABEL = { thinking: 'Habibi is thinking…', listening: 'Listening… tap when you are done', speaking: 'Habibi is speaking… tap to interrupt', idle: 'Tap to talk' }

  return (
    <div className="flex h-[calc(100vh-2.5rem)] min-h-112 flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-line md:h-[calc(100vh-5rem)]">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
        <span className="grid size-10 place-items-center rounded-full bg-iris text-white"><Icon name="sparkles" className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold leading-tight">Habibi - Human Adaptive Brain for Intelligent Behaviour & Interaction</h2>
          <p className="text-xs text-muted">Your AI project buddy. Answers from your team's data and can't change anything.</p>
        </div>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Focus project" className="input w-auto max-w-44 py-2">
          <option value="">All projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {(canListen || canSpeak) && (
          <select value={lang} onChange={(e) => changeLang(e.target.value)} aria-label="Voice language" className="input w-auto py-2">
            {LANGUAGES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        )}
        <button onClick={toggleVoice} disabled={!canListen} aria-pressed={voice}
          title={canListen ? 'Talk to Habibi and hear the answers' : 'Voice chat needs Chrome, Edge or Safari'}
          className={`btn px-3 py-2 ${voice ? 'btn-primary' : 'btn-ghost'}`}>
          <Icon name="mic" />{voice ? 'End voice chat' : 'Voice chat'}
        </button>
        {messages.length > 0 && (
          <button onClick={() => { stopSpeaking(); setSpeakingAt(null); assistantChat.setState(() => []) }} disabled={ask.isPending} className="btn btn-ghost px-3 py-2">New chat</button>
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
            <h3 className="mb-1 font-display text-lg font-semibold">Hi, I'm Habibi. How can I help?</h3>
            <p className="mb-5 text-sm text-muted">Ask about your work, or try one of these{canListen ? ', or tap Voice chat and just talk to me' : ''}.</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border border-line px-3.5 py-2 text-sm transition hover:border-iris hover:bg-iris-soft hover:text-iris">{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex items-end gap-1.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <p className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm wrap-break-word whitespace-pre-wrap ${m.role === 'user' ? 'rounded-br-md bg-iris text-white' : 'rounded-bl-md bg-canvas text-ink'}`}>{m.content}</p>
            {m.role === 'assistant' && canSpeak && (
              <button onClick={() => readAloud(i, m.content)} aria-label={speakingAt === i ? 'Stop reading' : 'Read aloud'} className="btn btn-ghost mb-1 px-2 py-1.5 text-muted">
                <Icon name={speakingAt === i ? 'stop' : 'volume'} />
              </button>
            )}
          </div>
        ))}
        {ask.isPending && <p className="w-fit animate-pulse rounded-2xl rounded-bl-md bg-canvas px-4 py-2.5 text-sm text-muted">Habibi is thinking…</p>}
        <div ref={end} />
      </div>

      {voice && (
        <div className="flex items-center gap-4 border-t border-line bg-iris-soft px-5 py-3">
          <button onClick={press} disabled={state === 'thinking'} aria-label={LABEL[state]}
            className={`grid size-14 shrink-0 place-items-center rounded-full text-white shadow transition disabled:opacity-60 ${state === 'listening' ? 'animate-pulse bg-red-500' : 'bg-iris'}`}>
            <Icon name={state === 'speaking' ? 'stop' : 'mic'} className="size-6" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-iris">{LABEL[state]}</p>
            <p className="truncate text-sm text-muted">{listen.error || (listen.interim ? `“${listen.interim}”` : 'Speak naturally. I will answer out loud.')}</p>
          </div>
        </div>
      )}

      <div className="flex items-end gap-2 border-t border-line p-3">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={2000} aria-label="Ask Habibi" placeholder="Ask Habibi about your projects and tasks…"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() } }}
          className="input max-h-32 resize-none py-2.5" />
        {canListen && !voice && (
          <button onClick={() => (listen.listening ? listen.stop() : listen.start())} aria-label={listen.listening ? 'Stop dictating' : 'Dictate a question'}
            title={listen.error || (listen.listening ? 'Listening…' : 'Speak instead of typing')}
            className={`btn px-3.5 py-3 ${listen.listening ? 'animate-pulse bg-red-500 text-white' : 'btn-ghost'}`}><Icon name="mic" /></button>
        )}
        <button onClick={() => send()} disabled={!text.trim() || ask.isPending} aria-label="Send" className="btn btn-primary px-3.5 py-3"><Icon name="send" /></button>
      </div>
    </div>
  )
}
