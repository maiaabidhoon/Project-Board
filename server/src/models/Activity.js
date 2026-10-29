import mongoose from 'mongoose'
import { toJSON } from './json.js'

// Audit trail: who did what in a project
const activitySchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true, maxlength: 300 },
  },
  { timestamps: { createdAt: 'at', updatedAt: false }, toJSON },
)

activitySchema.index({ projectId: 1, at: -1 })
activitySchema.index({ at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 }) // keep 90 days

export default mongoose.model('Activity', activitySchema)
