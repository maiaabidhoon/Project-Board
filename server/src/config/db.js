import mongoose from 'mongoose'
import { env } from './env.js'

// Show where we are connecting without ever printing a password that may be inside the URI
const safeUri = (uri) => uri.replace(/\/\/([^:/@]+):[^@]*@/, '//$1:****@')

export async function connectDB() {
  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 5000 })
    console.log(`MongoDB connected: ${mongoose.connection.name}`)
  } catch (err) {
    console.error(`\nCould not connect to MongoDB at ${safeUri(env.mongoUri)}\n${err.message}\n`)
    console.error('The API (and so live chat) cannot start without a database. Either:')
    console.error('  1. start MongoDB locally (default port 27017), or')
    console.error('  2. set MONGODB_URI in server/.env to a MongoDB Atlas connection string')
    console.error('     (and in Atlas: Network Access -> allow your IP address).\n')
    process.exit(1)
  }
}
