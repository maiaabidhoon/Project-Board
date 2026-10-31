import mongoose from 'mongoose'

const ref = (model) => ({ type: mongoose.Schema.Types.ObjectId, ref: model })

const memberSchema = new mongoose.Schema(
  {
    userId: { ...ref('User'), required: true },
    joinedAt: { type: Date, default: Date.now }, // history from before this moment stays hidden from the member
    lastReadAt: { type: Date, default: Date.now }, // everything after this is "unread"
  },
  { _id: false },
)

// One document per direct chat ("dm") or group chat ("group")
const conversationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['dm', 'group'], required: true },
    name: { type: String, trim: true, maxlength: 60 }, // groups only
    ownerId: ref('User'), // groups only: the person who can rename, add and remove people, or delete the group
    dmKey: { type: String }, // "idA:idB" (sorted), so a pair of people only ever has one direct chat
    members: [memberSchema],
    lastMessage: {
      text: String,
      senderId: ref('User'),
      senderName: String,
      system: Boolean,
      at: Date,
    },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
)

conversationSchema.index({ 'members.userId': 1, lastMessageAt: -1 })
conversationSchema.index({ dmKey: 1 }, { unique: true, partialFilterExpression: { dmKey: { $type: 'string' } } })

export default mongoose.model('Conversation', conversationSchema)
