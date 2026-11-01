import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { env } from '../config/env.js'
import { validate } from '../middleware/validate.js'
import { assistantSchema } from '../schemas.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { buildContext, systemPrompt } from '../utils/assistantContext.js'
import { localAnswer } from '../utils/localAssistant.js'

// The OpenAI key lives only on the server. Each question costs money, so each person is limited per minute.
const router = Router()
const limiter = rateLimit({
  windowMs: 60_000, limit: 10, keyGenerator: (req) => req.user.id,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'You are asking too fast. Wait a moment and try again.' },
})

// Which mode is the assistant in? The UI shows a small hint when it is in basic mode.
router.get('/status', (_req, res) => res.json({ ai: Boolean(env.openaiKey) }))

// Ask OpenAI. Returns the reply text, or null (after logging why) so the caller can fall back to basic mode.
// The failure is never reported as 401: the client signs people out on 401, and a bad OpenAI key is not the user's fault.
async function askOpenAI(user, body) {
  const context = await buildContext(user, body.projectId)
  let response
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.openaiKey}` },
      body: JSON.stringify({
        model: env.openaiModel,
        max_completion_tokens: 700,
        messages: [{ role: 'system', content: systemPrompt(context) }, ...body.messages.slice(-20)],
      }),
      signal: AbortSignal.timeout(30_000),
    })
  } catch (err) {
    console.error('OpenAI request failed:', err.name)
    return null
  }
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}))
    console.error(`OpenAI error ${response.status}:`, detail.error?.message)
    return null
  }
  const data = await response.json()
  return data.choices?.[0]?.message?.content?.trim() || null
}

router.post('/chat', limiter, validate(assistantSchema), asyncHandler(async (req, res) => {
  if (env.openaiKey) {
    const reply = await askOpenAI(req.user, req.body)
    if (reply) return res.json({ reply, mode: 'ai' })
  }
  // No key, or the AI service failed: answer from the database instead of showing an error
  const reply = await localAnswer(req.user, req.body.messages.at(-1).content, req.body.projectId)
  res.json({ reply, mode: 'basic', fallback: Boolean(env.openaiKey) })
}))

export default router
