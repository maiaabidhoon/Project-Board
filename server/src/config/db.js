import mongoose from 'mongoose'
import { env } from './env.js'

export async function connectDB() {
  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 5000 })
    console.log(`MongoDB connected: ${mongoose.connection.name}`)
  } catch (err) {
    console.error(`\nCould not connect to MongoDB at ${env.mongoUri}\n${err.message}\n`)
    console.error('Make sure MongoDB is running locally (default port 27017),')
    console.error('or set MONGODB_URI in server/.env (for example a free MongoDB Atlas connection string).\n')
    process.exit(1)
  }
}
