import mongoose from 'mongoose'
import { toJSON } from './json.js'

// Log of points an admin added, removed or reset by hand (task rewards live in the Reward ledger)
const adjustmentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    byId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    points: { type: Number, required: true }, // positive or negative: the change actually applied
    reason: { type: String, required: true, trim: true, maxlength: 140 },
    kind: { type: String, enum: ['adjust', 'reset'], default: 'adjust' },
  },
  { timestamps: { createdAt: 'at', updatedAt: false }, toJSON },
)
adjustmentSchema.index({ at: -1 })
adjustmentSchema.index({ userId: 1, at: -1 })

export default mongoose.model('RewardAdjustment', adjustmentSchema)
