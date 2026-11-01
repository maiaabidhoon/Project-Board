import { useState } from 'react'
import { useStore } from '@tanstack/react-store'
import { auth } from '../lib/store'
import { api } from '../lib/api'
import { go } from '../lib/router'
import { useAdminUsers, useAdminStats, useAction, useLogout } from '../lib/hooks'
import { ROLES, ROLE_STYLE } from '../lib/constants'
import Brand from '../components/Brand'
import Avatar from '../components/Avatar'
import Icon from '../components/Icon'
import AccountButton from '../components/AccountButton'
import NotificationBell from '../components/NotificationBell'
import Dashboard from '../features/admin/Dashboard'
import RewardManager from '../features/admin/RewardManager'

const TABS = [['dashboard', 'Dashboard', 'dashboard'], ['users', 'Team', 'users'], ['rewards', 'Rewards', 'trophy']]

const EMPTY = { name: '', email: '', password: '', role: 'member' }

export default function Admin() {
  const me = useStore(auth, (s) => s.user)
  const logout = useLogout()
  const { data: users = [], isLoading } = useAdminUsers()
  const { data: stats } = useAdminStats()
  const [form, setForm] = useState(EMPTY)
  const [tab, setTab] = useState('dashboard')
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })
  const keys = [['admin'], ['members']]

  const addUser = useAction(api.addUser, keys)
  const update = useAction(({ id, patch }) => api.updateUser(id, patch), keys)
  const remove = useAction(api.deleteUser, keys)

  const tiles = stats && [
    ['Users', stats.users, 'bg-iris text-white', 'text-white/70'],
    ['Projects', stats.projects], ['Open tasks', stats.byStatus.todo + stats.byStatus.doing], ['Completed', stats.byStatus.done],
  ]

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between bg-night px-5 py-4 text-white md:px-10">
        <div className="flex items-center gap-4">
          <Brand light />
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs">Admin</span>
        </div>
        <div className="flex items-center gap-1 text-sm">
          <button onClick={() => go('#/')} className="btn gap-1.5 px-3 py-2 text-white/70 hover:bg-white/10 hover:text-white"><Icon name="board" />Workspace</button>
          <NotificationBell align="right" />
          <AccountButton className="btn gap-1.5 px-3 py-2 text-white/70 hover:bg-white/10 hover:text-white" />
          <button onClick={logout} className="btn gap-1.5 px-3 py-2 text-white/70 hover:bg-white/10 hover:text-white"><Icon name="logout" />Sign out</button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 p-5 md:p-10">
        <nav className="flex gap-1 rounded-2xl bg-white p-1.5" aria-label="Admin sections">
          {TABS.map(([key, label, icon]) => (
            <button key={key} onClick={() => setTab(key)} aria-current={tab === key ? 'page' : undefined}
              className={`btn flex-1 gap-2 px-4 py-2.5 ${tab === key ? 'bg-iris text-white' : 'text-muted hover:bg-canvas hover:text-ink'}`}>
              <Icon name={icon} />{label}
            </button>
          ))}
        </nav>

        {tab === 'dashboard' && <Dashboard />}
        {tab === 'rewards' && <RewardManager />}
        {tab === 'users' && (
        <div className="space-y-10">
        <section>
          <h1 className="mb-5 font-display text-3xl font-semibold tracking-tight">Overview</h1>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {tiles?.map(([label, n, tone = 'bg-white', sub = 'text-muted']) => (
              <div key={label} className={`rounded-2xl p-5 ${tone}`}>
                <p className="font-display text-4xl font-semibold tabular-nums">{n}</p>
                <p className={`mt-1 text-sm ${sub}`}>{label}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
          <section>
            <h2 className="mb-4 font-display text-xl font-semibold">Team</h2>
            <div className="overflow-x-auto rounded-2xl bg-white">
              {isLoading ? <p className="p-5 text-muted">Loading users…</p> : (
                <table className="w-full text-left text-sm">
                  <tbody>
                    {users.map((u) => {
                      const self = u.id === me.id
                      return (
                        <tr key={u.id} className="border-b border-line last:border-0">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <Avatar name={u.name} size="size-9 text-xs" />
                              <div>
                                <p className={`font-medium ${u.active ? '' : 'text-muted line-through'}`}>{u.name}{self && <span className="ml-2 rounded-full bg-canvas px-2 py-0.5 text-xs font-normal text-muted">You</span>}</p>
                                <p className="text-muted">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <select value={u.role} disabled={self} aria-label={`Role for ${u.name}`}
                              onChange={(e) => update.mutate({ id: u.id, patch: { role: e.target.value } })}
                              className={`rounded-full border-0 px-3 py-1 text-xs font-medium capitalize disabled:opacity-100 ${ROLE_STYLE[u.role]}`}>
                              {ROLES.map((r) => <option key={r}>{r}</option>)}
                            </select>
                          </td>
                          <td className="p-4">
                            <button role="switch" aria-checked={u.active} aria-label={`${u.name} is ${u.active ? 'active' : 'deactivated'}`} disabled={self}
                              onClick={() => update.mutate({ id: u.id, patch: { active: !u.active } })}
                              className={`relative h-6 w-10 rounded-full transition disabled:opacity-50 ${u.active ? 'bg-iris' : 'bg-slate-300'}`}>
                              <span className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition ${u.active ? 'translate-x-4' : ''}`} />
                            </button>
                          </td>
                          <td className="p-4 text-right">
                            {!self && <button aria-label={`Delete ${u.name}`} onClick={() => confirm(`Delete ${u.name}?`) && remove.mutate(u.id)} className="btn btn-danger px-2 py-2"><Icon name="trash" /></button>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-4 font-display text-xl font-semibold">Add a user</h2>
            <form onSubmit={(e) => { e.preventDefault(); addUser.mutate(form, { onSuccess: () => setForm(EMPTY) }) }}
              className="space-y-3 rounded-2xl bg-white p-5">
              <input required placeholder="Full name" value={form.name} onChange={set('name')} className="input" />
              <input required type="email" placeholder="Email" value={form.email} onChange={set('email')} className="input" />
              <input required type="password" minLength={6} placeholder="Temporary password" value={form.password} onChange={set('password')} className="input" />
              <select value={form.role} onChange={set('role')} className="input capitalize" aria-label="Role">
                {ROLES.map((r) => <option key={r}>{r}</option>)}
              </select>
              <button disabled={addUser.isPending} className="btn btn-primary w-full">Add user</button>
            </form>
          </section>
        </div>
        </div>
        )}
      </main>
    </div>
  )
}
