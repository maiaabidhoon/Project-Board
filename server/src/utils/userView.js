import { permissionsFor } from '../config/permissions.js'

// What the client receives about the signed-in user, including what they may do
export const userView = (u) => ({
  id: u.id, name: u.name, email: u.email, role: u.role, active: u.active,
  permissions: permissionsFor(u.role),
})
