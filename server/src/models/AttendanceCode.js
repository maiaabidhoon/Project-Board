import mongoose from 'mongoose'

// The day's OTP. Sending a new one on the same day replaces the old one (which stops working).
const attendanceCodeSchema = new mongoose.Schema({
  day: { type: String, required: true, unique: true },
  code: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  issuedAt: { type: Date, default: Date.now },
})

export default mongoose.model('AttendanceCode', attendanceCodeSchema)
