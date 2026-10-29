import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { ROLES } from '../config/permissions.js'
import { toJSON } from './json.js'

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'member', index: true },
    active: { type: Boolean, default: true },
    rewards: {
      points: { type: Number, default: 0 },
      completed: { type: Number, default: 0 },
      onTime: { type: Number, default: 0 },
      high: { type: Number, default: 0 },
      streak: { type: Number, default: 0 },
      longestStreak: { type: Number, default: 0 },
      lastCompletedOn: { type: String, default: null },
      badges: [{ _id: false, key: String, at: Date }],
    },
    passwordChangedAt: { type: Date }, // older sessions stop working after a password change
  },
  { timestamps: true, toJSON },
)

userSchema.index({ 'rewards.points': -1 }) // leaderboard

userSchema.pre('save', async function () {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10)
    this.passwordChangedAt = new Date()
  }
})

userSchema.methods.verifyPassword = function (plain) {
  return bcrypt.compare(plain, this.password)
}

export default mongoose.model('User', userSchema)
