import { useEffect } from 'react'
import Icon from './Icon'

export default function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-night/50 p-4" onClick={onClose}>
      <div role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-md animate-pop flex-col rounded-2xl bg-white text-ink shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="btn btn-ghost px-2 py-2"><Icon name="x" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
