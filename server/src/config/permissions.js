// Roles ordered from least to most privileged
export const ROLES = ['member', 'manager', 'admin']

// permission -> roles allowed. Add a line here to introduce a new rule.
export const PERMISSIONS = {
  'project:create': ['manager', 'admin'],
  'project:delete': ['manager', 'admin'],
  'task:create': ['manager', 'admin'],
  'task:edit': ['manager', 'admin'], // rename and reassign
  'task:checklist': ['manager', 'admin'], // any task
  'task:checklist:own': ['member', 'manager', 'admin'],
  'project:export': ['manager', 'admin'],
  'task:delete': ['manager', 'admin'],
  'task:move': ['manager', 'admin'], // any task
  'task:move:own': ['member', 'manager', 'admin'], // only tasks assigned to you
  'comment:create': ['manager', 'admin'], // any task
  'comment:create:own': ['member', 'manager', 'admin'],
  'assistant:use': ['member', 'manager', 'admin'],
  'meeting:create': ['member', 'manager', 'admin'],
  'report:view': ['manager', 'admin'],
  'chat:group:create': ['member', 'manager', 'admin'],
  'attendance:mark': ['member', 'manager', 'admin'], // enter the daily OTP
  'attendance:send': ['admin'], // generate and send the daily OTP
  'attendance:view': ['manager', 'admin'], // see everyone's attendance
  'announcement:post': ['manager', 'admin'],
  'user:manage': ['admin'],
}

export const permissionsFor = (role) =>
  Object.keys(PERMISSIONS).filter((p) => PERMISSIONS[p].includes(role))
