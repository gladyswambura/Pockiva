import { useEffect, useState, useCallback } from 'react'

interface ToastData {
  id: string
  message: string
  onUndo?: () => void
}

let _show: ((t: ToastData) => void) | null = null

export function showToast(message: string, onUndo?: () => void) {
  _show?.({ id: crypto.randomUUID(), message, onUndo })
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastData[]>([])

  useEffect(() => {
    _show = (t) => {
      setToasts(prev => [...prev, t])
      setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), 5000)
    }
    // Listen for idle-timeout warnings from useIdleTimeout
    const onIdleWarning = (e: Event) => {
      const detail = (e as CustomEvent).detail as { minutesLeft: number }
      _show?.({
        id: crypto.randomUUID(),
        message: `You'll be signed out in ${detail.minutesLeft} minute${detail.minutesLeft !== 1 ? 's' : ''} due to inactivity.`,
      })
    }
    window.addEventListener('pockiva:idle-warning', onIdleWarning)
    return () => {
      _show = null
      window.removeEventListener('pockiva:idle-warning', onIdleWarning)
    }
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(x => x.id !== id))
  }, [])

  return (
    <div style={{
      position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
      zIndex: 100, display: 'flex', flexDirection: 'column', gap: 8,
      pointerEvents: 'none', width: 'min(360px, 92vw)',
    }}>
      {toasts.map(t => (
        <div
          key={t.id}
          role="status"
          aria-live="polite"
          style={{
            background: 'var(--color-primary)', color: '#fff',
            borderRadius: 'var(--radius-card)', padding: '12px 16px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            gap: 12, pointerEvents: 'all', boxShadow: '0 4px 16px rgba(0,0,0,.2)',
            animation: 'slideUp var(--dur-normal) var(--ease)',
          }}
        >
          <span style={{ fontSize: 14 }}>{t.message}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {t.onUndo && (
              <button
                onClick={() => { t.onUndo?.(); dismiss(t.id) }}
                style={{
                  background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff',
                  borderRadius: 8, padding: '4px 10px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Undo
              </button>
            )}
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.7)', cursor: 'pointer', fontSize: 16 }}
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
