import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '../lib/api'
import { setSession, notify } from '../lib/store'
import Icon from './Icon'

const EMPTY = { currentPassword: '', newPassword: '', confirm: '' }

// Button + dialog for changing your own password
export default function AccountButton({ className }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const change = useMutation({
    mutationFn: () => api.changePassword(form.currentPassword, form.newPassword),
    onSuccess: ({ token, user }) => { setSession(token, user); notify('Password updated', 'success'); setOpen(false); setForm(EMPTY) },
    onError: (e) => notify(e.message),
  })

  const submit = (e) => {
    e.preventDefault()
    if (form.newPassword !== form.confirm) return notify('The new passwords do not match')
    change.mutate()
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={className}><Icon name="key" />Account</button>
      {open && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-night/50 p-4" onClick={() => setOpen(false)}>
          <form role="dialog" aria-label="Change password" onSubmit={submit} onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm animate-pop space-y-4 rounded-2xl bg-white p-6 text-ink shadow-2xl">
            <h2 className="font-display text-xl font-semibold">Change password</h2>
            <input required type="password" autoComplete="current-password" placeholder="Current password" value={form.currentPassword} onChange={set('currentPassword')} className="input" />
            <input required type="password" minLength={6} autoComplete="new-password" placeholder="New password (6+ characters)" value={form.newPassword} onChange={set('newPassword')} className="input" />
            <input required type="password" autoComplete="new-password" placeholder="Repeat new password" value={form.confirm} onChange={set('confirm')} className="input" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">Cancel</button>
              <button disabled={change.isPending} className="btn btn-primary">Update password</button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
