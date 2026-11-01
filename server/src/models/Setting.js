import mongoose from 'mongoose'

// Small key/value store for settings an admin can change at runtime (e.g. reward point values)
const settingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })

export default mongoose.model('Setting', settingSchema)
