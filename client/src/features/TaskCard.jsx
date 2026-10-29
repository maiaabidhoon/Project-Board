import Avatar from '../components/Avatar'
import Icon from '../components/Icon'
import { firstName, dueInfo } from '../lib/utils'
import { PRIORITIES } from '../lib/constants'

export default function TaskCard({ task, assignee, project, canMove, first, last, onOpen, onMove }) {
  const priority = PRIORITIES.find((p) => p.key === task.priority)
  const due = dueInfo(task.dueDate, task.status)

  return (
    <article draggable={canMove} onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}
      className={`group rounded-xl border border-line/70 bg-white p-3.5 shadow-[0_1px_2px_rgba(24,27,52,.06)] transition hover:shadow-md ${canMove ? 'cursor-grab active:cursor-grabbing' : ''}`}>
      <button onClick={onOpen} className="block w-full text-left text-sm leading-snug font-medium">{task.title}</button>

      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
        {project && <span className="rounded-full bg-iris-soft px-2 py-0.5 text-iris">{project.name}</span>}
        {task.status !== 'done' && priority && <span className={`flex items-center gap-1 ${priority.tone}`}><Icon name="flag" className="size-3" />{priority.label}</span>}
        {due && <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 ${due.tone}`}><Icon name="calendar" className="size-3" />{due.overdue ? 'Overdue · ' : ''}{due.label}</span>}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <span className="flex items-center gap-2">
          {assignee
            ? <><Avatar name={assignee.name} size="size-6 text-[10px]" />{firstName(assignee.name)}</>
            : <><span className="size-6 rounded-full border border-dashed border-muted/50" />Unassigned</>}
        </span>
        <span className="flex items-center gap-1">
          {task.checklist?.length > 0 && <span className="mr-1 flex items-center gap-1"><Icon name="list" className="size-3.5" />{task.checklist.filter((c) => c.done).length}/{task.checklist.length}</span>}
          {task.comments.length > 0 && <span className="mr-1 flex items-center gap-1"><Icon name="chat" className="size-3.5" />{task.comments.length}</span>}
          {canMove && (
            <span className="flex gap-0.5 opacity-100 transition md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
              {!first && <button onClick={() => onMove(-1)} aria-label="Move to previous column" className="rounded-md p-1 hover:bg-canvas hover:text-ink"><Icon name="left" className="size-3.5" /></button>}
              {!last && <button onClick={() => onMove(1)} aria-label="Move to next column" className="rounded-md p-1 hover:bg-canvas hover:text-ink"><Icon name="right" className="size-3.5" /></button>}
            </span>
          )}
        </span>
      </div>
    </article>
  )
}
