import mongoose from 'mongoose'
import { toJSON } from './json.js'

export const STATUSES = ['todo', 'doing', 'done']
export const PRIORITIES = ['low', 'medium', 'high']
const ref = (model, extra = {}) => ({ type: mongoose.Schema.Types.ObjectId, ref: model, ...extra })

const commentSchema = new mongoose.Schema(
  {
    authorId: ref('User', { required: true }),
    text: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { timestamps: { createdAt: 'at', updatedAt: false }, toJSON },
)

const checklistItemSchema = new mongoose.Schema(
  { text: { type: String, required: true, trim: true, maxlength: 100 }, done: { type: Boolean, default: false } },
  { toJSON },
)

const taskSchema = new mongoose.Schema(
  {
    projectId: ref('Project', { required: true }),
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    status: { type: String, enum: STATUSES, default: 'todo' },
    priority: { type: String, enum: PRIORITIES, default: 'medium' },
    dueDate: { type: Date, default: null },
    assigneeId: ref('User', { default: null }),
    createdBy: ref('User', { default: null }), // told when the work is finished or discussed
    checklist: [checklistItemSchema],
    comments: [commentSchema],
  },
  { timestamps: true, toJSON },
)

taskSchema.index({ projectId: 1, status: 1 }) // board queries
taskSchema.index({ assigneeId: 1 })
taskSchema.index({ dueDate: 1 }) // reminder job

export default mongoose.model('Task', taskSchema)
