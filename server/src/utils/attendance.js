import Conversation from '../models/Conversation.js'
import { startOfToday } from './dates.js'
import { memberIds } from './chat.js'

export const OTP_CHAT_NAME = 'Project Board OTP'
const OTP_KEY = 'system:otp' // unique, so there can only ever be one OTP channel

/**
 * Makes sure the read-only "Project Board OTP" chat exists and that every given user is in it.
 * New members see messages from the start of today, so someone who joins late still sees today's OTP.
 */
export async function ensureOtpChat(userIds) {
  const since = startOfToday()
  const ids = [...new Set(userIds.map(String))]
  let conv = await Conversation.findOne({ dmKey: OTP_KEY })
  if (!conv) {
    try {
      conv = await Conversation.create({ type: 'otp', name: OTP_CHAT_NAME, dmKey: OTP_KEY, members: ids.map((userId) => ({ userId, joinedAt: since })) })
    } catch (err) {
      if (err.code !== 11000) throw err
      conv = await Conversation.findOne({ dmKey: OTP_KEY }) // another request created it at the same moment
    }
  }
  const have = new Set(memberIds(conv))
  const missing = ids.filter((id) => !have.has(id))
  if (missing.length) {
    // Each add is guarded, so two requests at once can never put the same person in twice
    await Conversation.bulkWrite(missing.map((id) => ({
      updateOne: {
        filter: { _id: conv._id, 'members.userId': { $ne: id } },
        update: { $push: { members: { userId: id, joinedAt: since, lastReadAt: new Date() } } },
      },
    })))
    conv = await Conversation.findById(conv._id)
  }
  return conv
}
