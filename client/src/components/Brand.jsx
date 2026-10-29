export default function Brand({ light = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-8 place-items-center rounded-[10px] bg-iris">
        <svg viewBox="0 0 32 32" className="size-5" fill="white"><path d="M9 9h3v14H9zM14.5 9h3v9h-3zM20 9h3v11h-3z" /></svg>
      </span>
      <span className={`font-display text-xl font-semibold tracking-tight ${light ? 'text-white' : 'text-ink'}`}>ProjectBoard</span>
    </div>
  )
}
