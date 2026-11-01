import { z } from 'zod'
import { ROLES } from './config/permissions.js'
import { STATUSES, PRIORITIES } from './models/Task.js'

const text = (label, max = 80) =>
  z.string({ required_error: `${label} is required`, invalid_type_error: `${label} must be text` })
    .trim().min(1, `${label} is required`).max(max, `${label} must be under ${max} characters`)

const email = z.string({ required_error: 'Email is required' }).trim().toLowerCase().email('Enter a valid email')
const password = z.string({ required_error: 'Password is required' }).min(6, 'Password must be at least 6 characters')
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id')

// Date-only input (YYYY-MM-DD) or null to clear. Rejects impossible dates like 2026-02-31
const isRealDate = (s) => { const d = new Date(s); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s }
const dueDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date').refine(isRealDate, 'Use a valid date')
  .transform((s) => new Date(s)).nullable()

export const loginSchema = z.object({ email, password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required') })

export const projectSchema = z.object({ name: text('Project name'), description: z.string().trim().max(300).optional() })

export const taskCreateSchema = z.object({ title: text('Task title', 140) })

export const taskUpdateSchema = z
  .object({
    title: text('Task title', 140).optional(),
    status: z.enum(STATUSES).optional(),
    assigneeId: objectId.nullable().optional(),
    priority: z.enum(PRIORITIES).optional(),
    dueDate: dueDate.optional(),
    description: z.string().trim().max(2000, 'Description is too long').optional(),
  })
  .refine((b) => Object.keys(b).length > 0, 'Nothing to update')

export const commentSchema = z.object({ text: text('Comment', 1000) })

export const userCreateSchema = z.object({ name: text('Name'), email, password, role: z.enum(ROLES).default('member') })

export const userUpdateSchema = z.object({
  name: text('Name').optional(),
  role: z.enum(ROLES).optional(),
  active: z.boolean().optional(),
  password: password.optional(),
})

export const passwordChangeSchema = z
  .object({ currentPassword: z.string({ required_error: 'Enter your current password' }).min(1, 'Enter your current password'), newPassword: password })
  .refine((b) => b.currentPassword !== b.newPassword, 'New password must be different from the current one')

export const checklistSchema = z.object({
  items: z.array(z.object({ text: text('Checklist item', 100), done: z.boolean().default(false) }))
    .max(20, 'A checklist can have up to 20 items'),
})

// Chat
export const messageSchema = z.object({ text: text('Message', 2000) })
export const socketMessageSchema = messageSchema.extend({ conversationId: objectId })

const lowerId = objectId.transform((s) => s.toLowerCase())
export const conversationCreateSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('dm'), userId: lowerId }),
  z.object({
    type: z.literal('group'),
    name: text('Group name', 60),
    memberIds: z.array(lowerId, { required_error: 'Pick at least one other member' })
      .min(1, 'Pick at least one other member').max(49, 'A group can have up to 50 members'),
  }),
])
export const groupRenameSchema = z.object({ name: text('Group name', 60) })
export const addMembersSchema = z.object({ userIds: z.array(lowerId).min(1, 'Pick at least one person').max(49) })
export const messagesQuerySchema = z.object({ before: objectId.optional() })

// Meetings
const when = z.string({ required_error: 'Pick a date and time' })
  .refine((v) => !Number.isNaN(new Date(v).getTime()), 'Pick a valid date and time').transform((v) => new Date(v))

export const meetingSchema = z.object({
  title: text('Meeting title', 100),
  description: z.string().trim().max(500, 'Description is too long').optional(),
  startsAt: when,
  durationMin: z.number().int().min(5, 'Meetings are at least 5 minutes').max(480, 'Meetings can be up to 8 hours').default(30),
  location: z.string().trim().max(200, 'Location is too long').optional(),
  projectId: objectId.nullable().optional(),
  attendeeIds: z.array(objectId).max(50, 'Too many attendees').default([]),
})

export const meetingUpdateSchema = meetingSchema.partial().extend({ notes: z.string().trim().max(3000, 'Notes are too long').optional() })
  .refine((b) => Object.keys(b).length > 0, 'Nothing to update')

// AI assistant
// No cap on how many messages a conversation can have. The app sends the most recent ones that fit, and the server
// hands the model only the latest few to keep each answer fast and cheap. A single message from you is up to 2000
// characters; the assistant's own earlier answers are longer, so they get more room (they used to be rejected).
export const assistantSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1, 'Message is empty').max(8000, 'Message is too long'),
  }).refine((m) => m.role === 'assistant' || m.content.length <= 2000, 'Message is too long (2000 characters max)')).min(1),
  projectId: objectId.nullable().optional(),
}).refine((b) => b.messages.at(-1).role === 'user', 'The last message must be yours')

// Attendance
export const otpEntrySchema = z.object({ otp: z.string({ required_error: 'Enter the 6-digit OTP' }).trim().regex(/^\d{6}$/, 'Enter the 6-digit OTP') })
export const otpSendSchema = z.object({ validMinutes: z.number().int().min(5, 'At least 5 minutes').max(240, 'At most 4 hours').default(30) })
export const attendanceDaySchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date').refine(isRealDate, 'Use a valid date').optional() })
export const attendanceMonthSchema = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use a month like 2026-11').optional() })
