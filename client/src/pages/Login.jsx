import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '../lib/api'
import { setSession } from '../lib/store'
import { go } from '../lib/router'
import Brand from '../components/Brand'

const LANES = [
  ['To do', 'bg-slate-400', ['Write launch copy', 'Fix login crash']],
  ['In progress', 'bg-amber-400', ['Draft new homepage']],
  ['Done', 'bg-emerald-500', ['Audit current pages', 'Set up project']],
]

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const login = useMutation({
    mutationFn: () => api.login(email, password),
    onSuccess: ({ token, user }) => { setSession(token, user); go(user.role === 'admin' ? '#/admin' : '#/') },
  })

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Brand side: a miniature of the board itself */}
      <section className="hidden flex-col justify-between bg-night p-12 text-white lg:flex">
        <Brand light />
        <div>
          <h2 className="mb-3 max-w-md font-display text-5xl leading-[1.05] font-semibold tracking-tight">Every task, one board.</h2>
          <p className="mb-10 max-w-sm text-white/60">Plan projects, assign work and keep your team in sync.</p>
          <div className="grid max-w-xl grid-cols-3 gap-3">
            {LANES.map(([label, dot, cards]) => (
              <div key={label} className="rounded-2xl bg-white/5 p-3">
                <p className="mb-3 flex items-center gap-2 text-xs text-white/70"><span className={`size-2 rounded-full ${dot}`} />{label}</p>
                <div className="space-y-2">
                  {cards.map((c) => <p key={c} className="rounded-lg bg-white/10 p-2.5 text-xs leading-snug">{c}</p>)}
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-sm text-white/40">Built with React, TanStack, Node and MongoDB</p>
      </section>

      <section className="grid place-items-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden"><Brand /></div>
          <h1 className="mb-1 font-display text-3xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mb-8 text-muted">Sign in to your workspace.</p>

          <form onSubmit={(e) => { e.preventDefault(); login.mutate() }} className="space-y-4">
            <label className="block text-sm font-medium">Email
              <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="input mt-1.5 font-normal" />
            </label>
            <label className="block text-sm font-medium">Password
              <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="input mt-1.5 font-normal" />
            </label>
            {login.isError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{login.error.message}</p>}
            <button disabled={login.isPending} className="btn btn-primary w-full">{login.isPending ? 'Signing in…' : 'Sign in'}</button>
          </form>
        </div>
      </section>
    </main>
  )
}
