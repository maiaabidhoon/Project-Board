import mongoose from 'mongoose'
import { toJSON } from './json.js'

const ref = (model) => ({ type: mongoose.Schema.Types.ObjectId, ref: model })

const meetingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    startsAt: { type: Date, required: true },
    durationMin: { type: Number, default: 30, min: 5, max: 480 },
    location: { type: String, trim: true, maxlength: 200, default: '' }, // a room, or a video-call link
    projectId: { ...ref('Project'), default: null }, // optional: which project it is about
    organizerId: { ...ref('User'), required: true },
    attendees: [ref('User')], // everyone invited, not including the organizer
    notes: { type: String, trim: true, maxlength: 3000, default: '' }, // minutes, written by the organizer
  },
  { timestamps: true, toJSON },
)

meetingSchema.index({ startsAt: 1 })
meetingSchema.index({ organizerId: 1 })
meetingSchema.index({ attendees: 1 })

export default mongoose.model('Meeting', meetingSchema)
