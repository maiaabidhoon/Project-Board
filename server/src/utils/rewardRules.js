import Setting from '../models/Setting.js'
import { POINTS, ON_TIME_BONUS } from '../config/rewards.js'

// Point values an admin can change. The defaults in config/rewards.js apply until they do.
const KEY = 'reward-rules'
const DEFAULTS = { low: POINTS.low, medium: POINTS.medium, high: POINTS.high, onTimeBonus: ON_TIME_BONUS }

let cache = null // the rules are read on every task completion, so keep them in memory

export async function getRewardRules() {
  if (cache) return cache
  const row = await Setting.findOne({ key: KEY }).lean()
  cache = { ...DEFAULTS, ...(row?.value ?? {}) }
  return cache
}

export async function saveRewardRules(rules, userId) {
  const value = { low: rules.low, medium: rules.medium, high: rules.high, onTimeBonus: rules.onTimeBonus }
  await Setting.findOneAndUpdate({ key: KEY }, { value, updatedBy: userId }, { upsert: true })
  cache = { ...DEFAULTS, ...value }
  return cache
}
