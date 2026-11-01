import { Router } from 'express'
import User from '../models/User.js'
import Reward from '../models/Reward.js'
import { BADGES, levelFor } from '../config/rewards.js'
import { dayOf } from '../utils/rewards.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { getRewardRules } from '../utils/rewardRules.js'

const router = Router()

// My points, level, streak, badges and recent rewards
router.get('/me', asyncHandler(async (req, res) => {
  const [user, history] = await Promise.all([
    User.findById(req.user.id).select('rewards'),
    Reward.find({ userId: req.user.id }).sort('-at').limit(15),
  ])
  const r = user.rewards
  const today = dayOf(new Date())
  const yesterday = dayOf(new Date(Date.now() - 24 * 60 * 60 * 1000))
  const earnedAt = Object.fromEntries(r.badges.map((b) => [b.key, b.at]))

  res.json({
    stats: {
      points: r.points, completed: r.completed, onTime: r.onTime, high: r.high, longestStreak: r.longestStreak,
      streak: [today, yesterday].includes(r.lastCompletedOn) ? r.streak : 0, // a missed day breaks the streak
    },
    level: levelFor(r.points),
    badges: BADGES.map(({ key, name, description }) => ({ key, name, description, earnedAt: earnedAt[key] ?? null })),
    history,
  })
}))

// How many points each kind of task is worth (set by the admin)
router.get('/rules', asyncHandler(async (_req, res) => res.json(await getRewardRules())))

// Everyone active, highest points first
router.get('/leaderboard', asyncHandler(async (_req, res) => {
  const users = await User.find({ active: true }).select('name role rewards.points rewards.completed').sort({ 'rewards.points': -1, name: 1 }).limit(20)
  res.json(users.map((u) => ({
    id: u.id, name: u.name, role: u.role, points: u.rewards.points, completed: u.rewards.completed, level: levelFor(u.rewards.points).name,
  })))
}))

export default router
