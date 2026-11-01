import mongoose from 'mongoose'
import { toJSON } from './json.js'

// A message from a manager/admin to the whole team
const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    body: { type: String, trim: true, maxlength: 1500, default: '' },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    pinned: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'at', updatedAt: false }, toJSON },
)
announcementSchema.index({ pinned: -1, at: -1 })

export default mongoose.model('Announcement', announcementSchema)
