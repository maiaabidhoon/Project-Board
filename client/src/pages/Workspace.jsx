import { useEffect, useState } from 'react'
import { useStore } from '@tanstack/react-store'
import { ui, auth, select, notify } from '../lib/store'
import { api } from '../lib/api'
import { go } from '../lib/router'
import { useProjects, useMembers, useTasks, useRewards, useUnreadChats, useAction, useCan, useLogout } from '../lib/hooks'
import { ROLE_STYLE } from '../lib/constants'
import Brand from '../components/Brand'
import Avatar from '../components/Avatar'
import Icon from '../components/Icon'
import AccountButton from '../components/AccountButton'
import NotificationBell from '../components/NotificationBell'
import Board from '../features/Board'
import Rewards from '../features/Rewards'
import Chat from '../features/chat/Chat'
import Meetings from '../features/Meetings'
import Reports from '../features/Reports'
import Assistant from '../features/Assistant'

const navClass = (active) =>
  `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
    active ? 'bg-white/10 font-medium text-white' : 'text-white/65 hover:bg-white/5 hover:text-white'}`

export default function Workspace() {
  const { data: projects = [], isLoading } = useProjects()
  const { data: members = [] } = useMembers()
  const { data: myTasks = [] } = useTasks('mine')
  const projectId = useStore(ui, (s) => s.projectId)
  const user = useStore(auth, (s) => s.user)
  const logout = useLogout()
  const canCreate = useCan('project:create')
  const canDelete = useCan('project:delete')
  const isAdmin = useCan('user:manage')
  const [name, setName] = useState('')

  const addProject = useAction(api.addProject, [['projects']])
  const removeProject = useAction(api.deleteProject, [['projects']])

  const isMine = projectId === 'mine'
  const isRewards = projectId === 'rewards'
  const isChat = projectId === 'chat'
  const isMeetings = projectId === 'meetings'
  const isAssistant = projectId === 'assistant'
  const canReport = useCan('report:view')
  const isReports = projectId === 'reports' && canReport
  const unreadChats = useUnreadChats()
  const { data: rewards } = useRewards()
  const canExport = useCan('project:export')
  const current = projects.find((p) => p.id === projectId)
  const openMine = myTasks.filter((t) => t.status !== 'done').length

  // Land on the right page: members start on "My tasks", everyone else on the first project
  useEffect(() => {
    if (isLoading || projectId === 'mine' || projectId === 'rewards' || projectId === 'chat' || projectId === 'meetings' || isAssistant || isReports || projects.some((p) => p.id === projectId)) return
    select({ projectId: user.role === 'member' ? 'mine' : (projects[0]?.id ?? 'mine'), taskId: null })
  }, [projects, projectId, isLoading, user.role, canReport])

  const submit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    addProject.mutate(name, { onSuccess: (p) => { select({ projectId: p.id, taskId: null }); setName('') } })
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col bg-night p-5 text-white md:sticky md:top-0 md:h-screen md:w-72">
        <div className="flex items-center justify-between">
          <Brand light />
          <NotificationBell align="sidebar" />
        </div>

        <nav className="mt-6 flex-1 space-y-0.5 overflow-y-auto">
          <button onClick={() => select({ projectId: 'mine', taskId: null })} className={navClass(isMine)}>
            <Icon name="user" className="size-4 shrink-0 opacity-70" />
            <span className="flex-1">My tasks</span>
            {openMine > 0 && <span className="rounded-full bg-iris px-2 py-0.5 text-xs text-white">{openMine}</span>}
          </button>

          <button onClick={() => select({ projectId: 'chat', taskId: null })} className={navClass(isChat)}>
            <Icon name="chat" className="size-4 shrink-0 opacity-70" />
            <span className="flex-1">Chat</span>
            {unreadChats > 0 && <span className="rounded-full bg-iris px-2 py-0.5 text-xs text-white">{unreadChats > 99 ? '99+' : unreadChats}</span>}
          </button>

          <button onClick={() => select({ projectId: 'assistant', taskId: null })} className={navClass(isAssistant)}>
            <Icon name="sparkles" className="size-4 shrink-0 opacity-70" />
            <span className="flex-1">AI Assistant</span>
          </button>

          <button onClick={() => select({ projectId: 'meetings', taskId: null })} className={navClass(isMeetings)}>
            <Icon name="video" className="size-4 shrink-0 opacity-70" />
            <span className="flex-1">Meetings</span>
          </button>

          {canReport && (
            <button onClick={() => select({ projectId: 'reports', taskId: null })} className={navClass(isReports)}>
              <Icon name="chart" className="size-4 shrink-0 opacity-70" />
              <span className="flex-1">Reports</span>
            </button>
          )}

          <button onClick={() => select({ projectId: 'rewards', taskId: null })} className={navClass(isRewards)}>
            <Icon name="trophy" className="size-4 shrink-0 opacity-70" />
            <span className="flex-1">Rewards</span>
            {rewards && <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs tabular-nums">{rewards.stats.points} pts</span>}
          </button>

          <p className="px-3 pt-5 pb-1 text-sm text-white/50">Projects</p>
          {isLoading && <p className="px-3 text-sm text-white/50">Loading…</p>}
          {projects.map((p) => (
            <button key={p.id} onClick={() => select({ projectId: p.id, taskId: null })} className={navClass(p.id === projectId)}>
              <Icon name="folder" className="size-4 shrink-0 opacity-70" />
              <span className="truncate">{p.name}</span>
            </button>
          ))}
        </nav>

        {canCreate && (
          <form onSubmit={submit} className="mt-3 flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New project" aria-label="New project name" className="input-dark min-w-0 flex-1" />
            <button className="btn btn-primary px-3" aria-label="Add project"><Icon name="plus" /></button>
          </form>
        )}

        <div className="mt-6 border-t border-white/10 pt-4">
          <div className="mb-3 flex items-center gap-3">
            <Avatar name={user.name} size="size-9 text-xs" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs capitalize ${ROLE_STYLE[user.role]}`}>{user.role}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1 text-sm">
            {isAdmin && <button onClick={() => go('#/admin')} className="btn flex-1 gap-1.5 px-2 py-2 text-white/70 hover:bg-white/10 hover:text-white"><Icon name="shield" />Admin</button>}
            <AccountButton className="btn flex-1 gap-1.5 px-2 py-2 text-white/70 hover:bg-white/10 hover:text-white" />
            <button onClick={logout} className="btn flex-1 gap-1.5 px-2 py-2 text-white/70 hover:bg-white/10 hover:text-white"><Icon name="logout" />Sign out</button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-5 md:p-10">
        {isChat ? (
          <Chat />
        ) : isAssistant ? (
          <Assistant />
        ) : isMeetings ? (
          <Meetings />
        ) : isReports ? (
          <Reports />
        ) : isRewards ? (
          <Rewards />
        ) : isMine || current ? (
          <>
            <header className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-3xl font-semibold tracking-tight">{isMine ? 'My tasks' : current.name}</h2>
                <p className="mt-1 text-muted">{isMine ? 'Everything assigned to you, across all projects.' : current.description}</p>
                {!isMine && canExport && (
                  <button onClick={() => api.exportProject(current.id).catch((e) => notify(e.message))} className="btn btn-ghost mt-3 gap-1.5 px-3 py-2">
                    <Icon name="download" />Export CSV
                  </button>
                )}
              </div>
              {!isMine && canDelete && (
                <button className="btn btn-danger gap-1.5 px-3 py-2"
                  onClick={() => confirm(`Delete "${current.name}" and all its tasks?`) &&
                    removeProject.mutate(current.id, { onSuccess: () => select({ projectId: null, taskId: null }) })}>
                  <Icon name="trash" />Delete
                </button>
              )}
            </header>

            {!isMine && user.role === 'member' && (
              <p className="mb-6 rounded-xl bg-iris-soft px-4 py-2.5 text-sm text-iris">
                You can see everything in this project, but you can only update tasks assigned to you. Find them under <b>My tasks</b>.
              </p>
            )}
            <Board projectId={projectId} projects={projects} members={members} />
          </>
        ) : !isLoading && (
          <div className="grid h-full min-h-80 place-items-center text-center">
            <div>
              <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-iris-soft text-iris"><Icon name="board" className="size-6" /></span>
              <h2 className="mb-1 font-display text-xl font-semibold">No projects yet</h2>
              <p className="text-muted">{canCreate ? 'Add your first project from the sidebar.' : 'A manager will add one soon.'}</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
