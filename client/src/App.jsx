import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useStore } from '@tanstack/react-store'
import { auth, setSession } from './lib/store'
import { api } from './lib/api'
import { connectSocket, disconnectSocket } from './lib/chat'
import { useHash, go } from './lib/router'
import Toasts from './components/Toasts'
import RewardPopup from './components/RewardPopup'
import Login from './pages/Login'
import Workspace from './pages/Workspace'
import Admin from './pages/Admin'

export default function App() {
  const { token, user } = useStore(auth)
  const hash = useHash()
  const qc = useQueryClient()

  // One live connection while signed in (re-opened if the token changes, e.g. after a password change)
  useEffect(() => {
    if (!token) return
    connectSocket(token, qc)
    return disconnectSocket
  }, [token])

  // Re-check who we are every 30 seconds, so role changes apply and deactivated users are signed out
  const { data: fresh } = useQuery({ queryKey: ['me'], queryFn: api.me, enabled: !!token, refetchInterval: 30_000 })
  useEffect(() => {
    if (fresh && token && JSON.stringify(fresh) !== JSON.stringify(user)) setSession(token, fresh)
  }, [fresh])

  let page
  if (!user) page = <Login />
  else if (hash.startsWith('#/admin')) {
    page = user.permissions.includes('user:manage') ? <Admin /> : <AdminsOnly />
  } else page = <Workspace />

  return <>{page}<Toasts /><RewardPopup /></>
}

function AdminsOnly() {
  return (
    <div className="grid min-h-screen place-items-center p-6 text-center">
      <div>
        <h1 className="mb-2 font-display text-2xl font-semibold">Admins only</h1>
        <p className="mb-5 text-muted">Your account doesn't have access to this page.</p>
        <button onClick={() => go('#/')} className="btn btn-primary">Back to workspace</button>
      </div>
    </div>
  )
}
