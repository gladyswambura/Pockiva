import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function BottomSheet({ open, onClose, title, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const trap = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', trap)
    return () => {
      document.removeEventListener('keydown', trap)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="sheet-backdrop"
        onClick={onClose}
        style={{
          background: 'var(--color-scrim)',
        }}
        aria-hidden
      />
      {/* Sheet */}
      <div
        ref={ref}
        className="sheet-panel"
        role="dialog"
        aria-modal
        aria-labelledby={titleId}
        style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-sheet) var(--radius-sheet) 0 0',
          padding: 'var(--space-6)',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 id={titleId} style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-primary)' }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: 'var(--color-text-muted)' }}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>

      <style>{`
        @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
      `}</style>
    </>
  )
}
