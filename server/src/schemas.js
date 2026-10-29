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
