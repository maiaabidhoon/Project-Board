import mongoose from 'mongoose'
import { toJSON } from './json.js'

// Points ledger. One entry per task, ever, so a task can never be rewarded twice.
const rewardSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    taskId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    title: { type: String, required: true },
    priority: String,
    points: { type: Number, required: true },
    onTime: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'at', updatedAt: false }, toJSON },
)

rewardSchema.index({ userId: 1, at: -1 })

export default mongoose.model('Reward', rewardSchema)
