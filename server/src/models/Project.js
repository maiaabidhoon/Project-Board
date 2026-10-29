import mongoose from 'mongoose'
import { toJSON } from './json.js'

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 300, default: '' },
  },
  { timestamps: true, toJSON },
)

export default mongoose.model('Project', projectSchema)
