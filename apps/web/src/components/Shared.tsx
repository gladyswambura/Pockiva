import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { useT } from '@/i18n/useT'
import { useStore } from '@/store'
import { WifiOff, RefreshCw, CheckCircle } from 'lucide-react'
import { onSyncChange, isSyncing, syncQueue } from '@/lib/sync'
import { getPendingOps } from '@/lib/db'

// ── EmptyState ────────────────────────────────────────────────

interface EmptyProps { icon?: ReactNode; message: string; action?: ReactNode }

export function EmptyState({ icon, message, action }: EmptyProps) {
  return (
    <div style={{
      textAlign: 'center', padding: '40px 24px',
      color: 'var(--color-text-muted)', display: 'flex',
      flexDirection: 'column', alignItems: 'center', gap: 12,
    }}>
      {icon && <div style={{ opacity: .5 }}>{icon}</div>}
      <p style={{ fontSize: 15, lineHeight: 1.5 }}>{message}</p>
      {action}
    </div>
  )
}

// ── OfflineBanner + SyncStatus ─────────────────────────────────

export function OfflineBanner() {
  const isOnline = useStore(s => s.isOnline)
  const t = useT()
  const [syncing, setSyncing] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [justSynced, setJustSynced] = useState(false)

  useEffect(() => {
    const update = () => {
      setSyncing(isSyncing())
      getPendingOps().then(ops => setPendingCount(ops.length)).catch(() => {})
    }
    const unsub = onSyncChange(update)
    update()
    return unsub
  }, [])

  useEffect(() => {
    if (!isOnline) return
    // When coming back online, try to sync
    syncQueue().then(result => {
      if (result.synced > 0) {
        setJustSynced(true)
        setTimeout(() => setJustSynced(false), 3000)
      }
      getPendingOps().then(ops => setPendingCount(ops.length)).catch(() => {})
    }).catch(() => {})
  }, [isOnline])

  if (!isOnline) {
    return (
      <div role="status" style={{
        background: 'var(--color-warning)', color: '#fff',
        fontSize: 13, padding: '8px 16px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <WifiOff size={14} />
        {t.offline}
      </div>
    )
  }

  if (syncing) {
    return (
      <div role="status" style={{
        background: 'var(--color-info)', color: '#fff',
        fontSize: 13, padding: '8px 16px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <RefreshCw size={14} className="spin" />
        Syncing {pendingCount} change{pendingCount !== 1 ? 's' : ''}…
      </div>
    )
  }

  if (justSynced) {
    return (
      <div role="status" style={{
        background: 'var(--color-success)', color: '#fff',
        fontSize: 13, padding: '8px 16px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <CheckCircle size={14} />
        All changes synced.
      </div>
    )
  }

  if (pendingCount > 0) {
    return (
      <div role="status" style={{
        background: 'var(--color-info)', color: '#fff',
        fontSize: 13, padding: '8px 16px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <RefreshCw size={14} />
        {pendingCount} pending change{pendingCount !== 1 ? 's' : ''} will sync when you&rsquo;re back online.
      </div>
    )
  }

  return null
}

// ── SkeletonLoader ────────────────────────────────────────────

interface SkeletonProps { width?: string; height?: number; radius?: number }

export function Skeleton({ width = '100%', height = 20, radius = 8 }: SkeletonProps) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'var(--color-border)',
      animation: 'pulse 1.5s ease-in-out infinite',
    }} />
  )
}

export function CardSkeleton() {
  return (
    <div style={{
      background: 'var(--color-surface)', borderRadius: 'var(--radius-card)',
      padding: 16, boxShadow: 'var(--shadow-card)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <Skeleton width="60%" height={12} />
      <Skeleton width="40%" height={28} />
      <Skeleton height={8} radius={6} />
    </div>
  )
}

// ── ConfirmDialog ─────────────────────────────────────────────

interface ConfirmProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger, onConfirm, onCancel }: ConfirmProps) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const el = ref.current
    if (!el) return

    // Focus the safe default (Cancel)
    cancelRef.current?.focus()

    // Lock body scroll
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const trap = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); return }
      if (e.key !== 'Tab') return
      const focusable = el.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
        e.preventDefault()
        ;(e.shiftKey ? last : first)?.focus()
      }
    }
    document.addEventListener('keydown', trap)
    return () => {
      document.removeEventListener('keydown', trap)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onCancel])

  if (!open) return null
  return (
    <>
      <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(11,38,80,.5)', zIndex: 60 }} aria-hidden />
      <div ref={ref} role="alertdialog" aria-modal aria-labelledby={titleId} style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        background: 'var(--color-surface)', borderRadius: 'var(--radius-card)',
        padding: 24, zIndex: 70, width: 'min(400px, 92vw)',
        boxShadow: '0 10px 40px rgba(0,0,0,.3)',
      }}>
        <h3 id={titleId} style={{ color: 'var(--color-primary)', marginBottom: 12 }}>{title}</h3>
        <p style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--color-text-muted)', marginBottom: 20 }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button ref={cancelRef} onClick={onCancel} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', fontWeight: 600 }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{
            padding: '10px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600,
            background: danger ? 'var(--color-danger)' : 'var(--color-primary)', color: '#fff',
          }}>
            {confirmLabel}
          </button>
        </div>
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
    </>
  )
}
