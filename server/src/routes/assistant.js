import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { env } from '../config/env.js'
import { validate } from '../middleware/validate.js'
import { assistantSchema } from '../schemas.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/HttpError.js'
import { buildContext, systemPrompt } from '../utils/assistantContext.js'

// The OpenAI key lives only on the server. Each question costs money, so each person is limited per minute.
const router = Router()
const limiter = rateLimit({
  windowMs: 60_000, limit: 10, keyGenerator: (req) => req.user.id,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'You are asking too fast. Wait a moment and try again.' },
})

// Not 401 on purpose: the client signs people out on 401, and a bad OpenAI key is not the user's fault
const FAILURES = {
  401: 'The AI service rejected the API key. Ask an admin to check OPENAI_API_KEY.',
  429: 'The AI service is busy or out of credit. Try again later.',
}

router.post('/chat', limiter, validate(assistantSchema), asyncHandler(async (req, res) => {
  if (!env.openaiKey) throw new HttpError(503, 'The AI assistant is not set up yet. Add OPENAI_API_KEY to server/.env and restart the server.')

  const context = await buildContext(req.user, req.body.projectId)
  let response
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.openaiKey}` },
      body: JSON.stringify({
        model: env.openaiModel,
        max_completion_tokens: 700,
        messages: [{ role: 'system', content: systemPrompt(context) }, ...req.body.messages.slice(-10)],
      }),
      signal: AbortSignal.timeout(30_000),
    })
  } catch (err) {
    console.error('OpenAI request failed:', err.name)
    throw new HttpError(504, err.name === 'TimeoutError' ? 'The AI took too long to answer. Try again.' : 'Could not reach the AI service.')
  }

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}))
    console.error(`OpenAI error ${response.status}:`, detail.error?.message)
    throw new HttpError(502, FAILURES[response.status] ?? 'The AI service had a problem. Try again.')
  }

  const data = await response.json()
  const reply = data.choices?.[0]?.message?.content?.trim()
  if (!reply) throw new HttpError(502, 'The AI returned an empty answer. Try rephrasing.')
  res.json({ reply })
}))

export default router
