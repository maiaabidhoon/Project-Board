// Wipes the database and recreates the team accounts:  npm run reset-db
import mongoose from 'mongoose'
import { env } from '../config/env.js'
import { connectDB } from '../config/db.js'
import { seed } from '../utils/seed.js'
import User from '../models/User.js'
import Project from '../models/Project.js'
import Task from '../models/Task.js'
import Activity from '../models/Activity.js'
import Notification from '../models/Notification.js'
import Conversation from '../models/Conversation.js'
import Message from '../models/Message.js'
import Meeting from '../models/Meeting.js'

if (env.isProd && process.env.CONFIRM_RESET !== 'yes') {
  console.error('Refusing to wipe a production database. Set CONFIRM_RESET=yes to continue.')
  process.exit(1)
}

await connectDB()
await mongoose.connection.dropDatabase()
await Promise.all([User, Project, Task, Activity, Notification, Conversation, Message, Meeting].map((model) => model.createIndexes()))
await seed()
console.log(`Database "${mongoose.connection.name}" was reset.`)
await mongoose.disconnect()
