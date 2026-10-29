import mongoose from 'mongoose'
import { toJSON } from './json.js'

const ref = (model) => ({ type: mongoose.Schema.Types.ObjectId, ref: model })

const notificationSchema = new mongoose.Schema(
  {
    userId: { ...ref('User'), required: true }, // who receives it
    type: { type: String, required: true }, // assigned, status, comment, task, role, due-soon, overdue
    message: { type: String, required: true, maxlength: 300 },
    projectId: ref('Project'),
    taskId: ref('Task'),
    read: { type: Boolean, default: false },
    key: { type: String }, // de-duplication key for automatic reminders
  },
  { timestamps: { createdAt: 'at', updatedAt: false }, toJSON },
)

notificationSchema.index({ userId: 1, at: -1 })
notificationSchema.index({ userId: 1, read: 1 })
notificationSchema.index({ key: 1 }, { unique: true, sparse: true })
notificationSchema.index({ at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 60 }) // keep 60 days

export default mongoose.model('Notification', notificationSchema)
