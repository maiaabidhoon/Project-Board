import mongoose from 'mongoose'
import { toJSON } from './json.js'

// One document per person per day: it exists only if they entered that day's OTP
const attendanceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    day: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // YYYY-MM-DD in the configured TIMEZONE
    markedAt: { type: Date, default: Date.now },
  },
  { toJSON },
)

attendanceSchema.index({ userId: 1, day: 1 }, { unique: true }) // marking twice is impossible
attendanceSchema.index({ day: 1 })

export default mongoose.model('Attendance', attendanceSchema)
