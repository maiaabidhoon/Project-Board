import User from '../models/User.js'

// The team's accounts. Created once, when the database is empty.
// Everyone can change their own password later from Account > Change password.
const TEAM = [
  { name: 'Aabid Husain', email: 'aabid@projectboard.dev', password: 'admin@2026', role: 'admin' },
  { name: 'Faizul', email: 'faizul@projectboard.dev', password: 'faizul@2026', role: 'manager' },
  { name: 'Sohit Kumar', email: 'sohit@projectboard.dev', password: 'sohit@2026', role: 'member' },
  { name: 'Arun', email: 'arun@projectboard.dev', password: 'arun@2026', role: 'member' },
  { name: 'Kaushal', email: 'kaushal@projectboard.dev', password: 'kaushal@2026', role: 'member' },
  { name: 'Pramit', email: 'pramit@projectboard.dev', password: 'pramit@2026', role: 'member' },
]

export async function seed() {
  if (await User.estimatedDocumentCount()) return
  await User.create(TEAM)
  console.log(`Created ${TEAM.length} team accounts`)
}
