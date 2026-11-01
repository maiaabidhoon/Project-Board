import { env } from '../config/env.js'
import Reward from '../models/Reward.js'
import User from '../models/User.js'
import { BADGES, levelFor } from '../config/rewards.js'
import { getRewardRules } from './rewardRules.js'
import { notifyMany } from './notify.js'

export const dayOf = (date) => date.toLocaleDateString('en-CA', { timeZone: env.timezone }) // YYYY-MM-DD

/**
 * Called when a task moves to Done. Rewards the assignee once per task.
 * No points for tasks you created for yourself, so nobody can farm them.
 * Returns what was earned, or null when nothing is awarded.
 */
export async function awardCompletion(task) {
  const userId = task.assigneeId
  if (!userId || String(userId) === String(task.createdBy)) return null

  const now = new Date()
  const onTime = !!task.dueDate && dayOf(now) <= task.dueDate.toISOString().slice(0, 10)
  const rules = await getRewardRules() // point values the admin can change
  const points = rules[task.priority] + (onTime ? rules.onTimeBonus : 0)

  try {
    await Reward.create({ userId, taskId: task._id, projectId: task.projectId, title: task.title, priority: task.priority, points, onTime })
  } catch (err) {
    if (err.code === 11000) return null // this task was already rewarded
    throw err
  }

  const user = await User.findById(userId).select('rewards')
  if (!user) return null
  const r = user.rewards

  const today = dayOf(now)
  const yesterday = dayOf(new Date(now.getTime() - 24 * 60 * 60 * 1000))
  const streak = r.lastCompletedOn === today ? r.streak : r.lastCompletedOn === yesterday ? r.streak + 1 : 1
  const stats = {
    points: r.points + points,
    completed: r.completed + 1,
    onTime: r.onTime + (onTime ? 1 : 0),
    high: r.high + (task.priority === 'high' ? 1 : 0),
    longestStreak: Math.max(r.longestStreak, streak),
  }

  const have = new Set(r.badges.map((b) => b.key))
  const earned = BADGES.filter((b) => !have.has(b.key) && b.check(stats))
  const before = levelFor(r.points)
  const after = levelFor(stats.points)

  await User.updateOne({ _id: userId }, {
    $inc: { 'rewards.points': points, 'rewards.completed': 1, 'rewards.onTime': onTime ? 1 : 0, 'rewards.high': task.priority === 'high' ? 1 : 0 },
    $set: { 'rewards.streak': streak, 'rewards.longestStreak': stats.longestStreak, 'rewards.lastCompletedOn': today },
    ...(earned.length && { $push: { 'rewards.badges': { $each: earned.map((b) => ({ key: b.key, at: now })) } } }),
  })

  const tell = (message) => notifyMany([userId], { type: 'reward', message })
  tell(`You earned ${points} points for “${task.title}”${onTime ? ' (on-time bonus included)' : ''}`)
  earned.forEach((b) => tell(`Badge unlocked: ${b.name}. ${b.description}`))
  if (after.level > before.level) tell(`You reached level ${after.level}: ${after.name}`)

  return {
    userId: String(userId), title: task.title, points, onTime, streak, totalPoints: stats.points,
    badges: earned.map(({ key, name, description }) => ({ key, name, description })),
    levelUp: after.level > before.level ? after.name : null,
  }
}
