import { useCallback, useEffect, useRef, useState } from 'react'

// Voice for Habibi, using the browser's built-in speech recognition and speech synthesis (free, no extra server).
// Speech recognition works in Chrome, Edge and Safari; Firefox can speak but not listen.

const Recognition = typeof window === 'undefined' ? undefined : window.SpeechRecognition || window.webkitSpeechRecognition
export const canListen = Boolean(Recognition)
export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window

export const LANGUAGES = [['en-IN', 'English (India)'], ['hi-IN', 'हिन्दी'], ['en-US', 'English (US)'], ['en-GB', 'English (UK)']]

// Text that reads well on screen can sound odd when spoken
export function speakable(text) {
  return text
    .replace(/https?:\/\/\S+/g, 'link')
    .replace(/^\s*[-•*]\s+/gm, '')
    .replace(/[“”]/g, '"')
    .replace(/[_*#`~]/g, '')
    .replace(/\s*\n+\s*/g, '. ')
    .replace(/\.\s*\./g, '.')
    .trim()
}

// Browsers cut off long utterances (Chrome stops after about 15 seconds), so speak sentence by sentence
function chunks(text) {
  const parts = text.match(/[^.!?।]+[.!?।]*\s*/g) ?? [text]
  const out = []
  let cur = ''
  for (const part of parts) {
    if (cur && (cur + part).length > 180) { out.push(cur); cur = part } else cur += part
  }
  if (cur.trim()) out.push(cur)
  return out
}

function pickVoice(lang) {
  const voices = window.speechSynthesis.getVoices()
  const base = lang.split('-')[0]
  return voices.find((v) => v.lang.replace('_', '-') === lang) ?? voices.find((v) => v.lang.replace('_', '-').startsWith(base)) ?? null
}

let generation = 0 // lets us ignore the "ended" events of speech that was cancelled on purpose

/** Read text aloud. onEnd runs only when it finished by itself, not when it was stopped or replaced. */
export function speak(text, { lang = 'en-IN', onEnd } = {}) {
  if (!canSpeak) return onEnd?.()
  const mine = ++generation
  window.speechSynthesis.cancel()
  const parts = chunks(speakable(text))
  if (!parts.length) return onEnd?.()
  const voice = pickVoice(lang)
  const done = () => { if (mine === generation) onEnd?.() }
  parts.forEach((part, i) => {
    const u = new SpeechSynthesisUtterance(part)
    u.lang = lang
    if (voice) u.voice = voice
    if (i === parts.length - 1) { u.onend = done; u.onerror = done }
    window.speechSynthesis.speak(u)
  })
}

export function stopSpeaking() {
  generation++
  if (canSpeak) window.speechSynthesis.cancel()
}

/**
 * Listen to the microphone once. When the person stops talking (or you call stop), onFinal gets the full sentence.
 * abort() throws the audio away instead.
 */
export function useListen({ lang, onFinal }) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState('')
  const rec = useRef(null)
  const finalRef = useRef(onFinal)
  finalRef.current = onFinal // always call the latest handler, never a stale one

  const start = useCallback(() => {
    if (!Recognition || rec.current) return
    setError('')
    const r = new Recognition()
    r.lang = lang
    r.interimResults = true
    r.continuous = false
    r.maxAlternatives = 1
    let heard = ''
    r._aborted = false
    r.onresult = (e) => {
      heard = Array.from(e.results).map((x) => x[0].transcript).join(' ')
      setInterim(heard)
    }
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setError('Microphone access is blocked. Allow it in your browser\'s address bar and try again.')
      else if (e.error === 'no-speech') setError("I didn't hear anything. Tap the mic and try again.")
      else if (e.error === 'audio-capture') setError('No microphone was found.')
      else if (e.error !== 'aborted') setError(`Voice input stopped (${e.error}).`)
    }
    r.onend = () => {
      rec.current = null
      setListening(false)
      setInterim('')
      const text = heard.trim()
      if (text && !r._aborted) finalRef.current?.(text)
    }
    rec.current = r
    try { r.start(); setListening(true) } catch { rec.current = null }
  }, [lang])

  const stop = useCallback(() => rec.current?.stop(), []) // finishes and delivers what was heard
  const abort = useCallback(() => {
    if (!rec.current) return
    rec.current._aborted = true
    rec.current.abort()
  }, [])

  useEffect(() => abort, [abort]) // release the microphone when leaving the screen
  return { listening, interim, error, start, stop, abort }
}
