import mongoose from 'mongoose'

const ref = (model) => ({ type: mongoose.Schema.Types.ObjectId, ref: model })

const messageSchema = new mongoose.Schema(
  {
    conversationId: { ...ref('Conversation'), required: true },
    senderId: ref('User'), // empty for system messages such as "Faizul added Arun"
    senderName: String, // kept so old messages still show a name after the person leaves or is removed
    text: { type: String, required: true, maxlength: 2000 },
    system: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'at', updatedAt: false } },
)

messageSchema.index({ conversationId: 1, _id: -1 })

export default mongoose.model('Message', messageSchema)
