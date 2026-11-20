import { useEffect, useState } from 'react'
import { EmptyState } from '@/components/Shared'
import { BottomSheet } from '@/components/BottomSheet'
import { AmountKeypad } from '@/components/AmountKeypad'
import { MoneyText } from '@/components/MoneyText'
import { useStore } from '@/store'
import { showToast } from '@/components/Toast'
import { apiFetch, newKey, getToken } from '@/lib/api'
import { formatMoney } from '@/lib/money'
import { PiggyBank, Lock, Unlock, ArrowDownLeft, ArrowUpRight } from 'lucide-react'

interface SavingsState {
  balance_cents: number
  lock_until: string | null
  history: { id: string; kind: string; amount_cents: number; created_at: string }[]
}

export function SavingsPanel() {
  const { _hasHydrated } = useStore()
  const [showMoveIn, setShowMoveIn] = useState(false)
  const [showMoveOut, setShowMoveOut] = useState(false)
  const [showLock, setShowLock] = useState(false)
  const [savings, setSavings] = useState<SavingsState | null>(null)
  const [loading, setLoading] = useState(true)

  const token = getToken()

  const refresh = () => {
    apiFetch<SavingsState>('/savings').then(setSavings).catch(() => {})
  }

  useEffect(() => {
    if (!_hasHydrated || !token) return
    refresh()
    setLoading(false)
  }, [token, _hasHydrated])

  const isLocked = savings?.lock_until && new Date(savings.lock_until + 'T23:59:59') > new Date()
  const hasBalance = savings !== null && savings.balance_cents > 0

  return (
    <div className="screen-content">
      {loading ? (
        <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
          Loading savings…
        </div>
      ) : hasBalance ? (
        <article className="savings-card">
          <div className="savings-card-head">
            <div className="savings-card-icon">
              <PiggyBank size={22} />
            </div>
            <div className="savings-card-info">
              <div className="savings-card-name">Protected savings</div>
              <div className="savings-card-amount">Locked money is harder to spend.</div>
            </div>
            {isLocked ? (
              <span className="tag tag--warning"><Lock size={12} /> Locked</span>
            ) : (
              <span className="tag tag--success"><Unlock size={12} /> Open</span>
            )}
          </div>

          <MoneyText cents={savings.balance_cents} size="xl" color="var(--color-text)" />

          {isLocked && savings.lock_until && (
            <div className="savings-card-lock">
              <Lock size={14} /> Locked until {savings.lock_until}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              onClick={() => setShowMoveIn(true)}
              disabled={!!isLocked}
              style={{
                flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--color-primary)',
                background: 'var(--color-surface)', color: 'var(--color-primary)',
                fontWeight: 700, cursor: isLocked ? 'not-allowed' : 'pointer', opacity: isLocked ? .5 : 1,
              }}
            >
              <ArrowDownLeft size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Move in
            </button>
            <button
              onClick={() => setShowMoveOut(true)}
              disabled={!!isLocked}
              style={{
                flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--color-border)',
                background: 'var(--color-surface)', color: 'var(--color-text)',
                fontWeight: 700, cursor: isLocked ? 'not-allowed' : 'pointer', opacity: isLocked ? .5 : 1,
              }}
            >
              <ArrowUpRight size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Move out
            </button>
          </div>

          <button
            onClick={() => setShowLock(true)}
            style={{
              marginTop: 4, minHeight: 44, padding: '8px 12px', borderRadius: 8, border: 'none',
              background: 'none', color: 'var(--color-text-muted)', fontSize: 13, cursor: 'pointer',
            }}
          >
            {isLocked ? 'Change lock date' : 'Set a lock date'}
          </button>
        </article>
      ) : (
        <EmptyState
          icon={<PiggyBank size={40} />}
          message="No savings yet. Move money into protected savings so it is harder to spend."
          action={
            <button
              onClick={() => setShowMoveIn(true)}
              style={{ padding: '10px 20px', background: 'var(--color-primary)', color: 'var(--color-on-primary)', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}
            >
              Move money to savings
            </button>
          }
        />
      )}

      {savings && savings.history.length > 0 && (
        <section style={{ marginTop: 8 }}>
          <h2 className="section-title">Recent activity</h2>
          <div className="transaction-list">
            {savings.history.map(h => (
              <div key={h.id} className="transaction-row">
                <div className="tx-icon" style={{ background: h.kind === 'save' ? 'var(--color-success)' : 'var(--color-warning)' }}>
                  {h.kind === 'save' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                </div>
                <div className="tx-details">
                  <div className="tx-description">{h.kind === 'save' ? 'Moved to savings' : 'Moved out of savings'}</div>
                  <div className="tx-meta">
                    <time>{new Date(h.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}</time>
                  </div>
                </div>
                <div className="tx-amount" style={{ color: h.kind === 'save' ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                  {formatMoney(h.amount_cents)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <MoveInSheet open={showMoveIn} onClose={() => setShowMoveIn(false)} onDone={refresh} />
      <MoveOutSheet open={showMoveOut} onClose={() => setShowMoveOut(false)} onDone={refresh} maxCents={savings?.balance_cents ?? 0} />
      <LockSheet open={showLock} onClose={() => setShowLock(false)} onDone={refresh} currentLock={savings?.lock_until ?? null} />
    </div>
  )
}

function MoveInSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { setSummary } = useStore()
  const handleConfirm = async (cents: number) => {
    try {
      await apiFetch('/savings/move-in', { method: 'POST', body: { amount_cents: cents }, idempotencyKey: newKey(), offlineFallback: true })
      await onDone()
      const s = await apiFetch<ReturnType<typeof useStore.getState>['summary']>('/summary'); setSummary(s!)
      showToast('Moved to savings.')
      onClose()
    } catch (e: unknown) {
      const err = e as { error?: { message?: string }; detail?: string }
      showToast(err?.error?.message ?? err?.detail ?? 'Could not move money to savings. Check your wallet balance.')
    }
  }
  return (
    <BottomSheet open={open} onClose={onClose} title="Move money to savings">
      <AmountKeypad onConfirm={handleConfirm} />
    </BottomSheet>
  )
}

function MoveOutSheet({ open, onClose, onDone, maxCents }: { open: boolean; onClose: () => void; onDone: () => void; maxCents: number }) {
  const { setSummary } = useStore()
  const handleConfirm = async (cents: number) => {
    try {
      await apiFetch('/savings/move-out', { method: 'POST', body: { amount_cents: cents }, idempotencyKey: newKey(), offlineFallback: true })
      await onDone()
      const s = await apiFetch<ReturnType<typeof useStore.getState>['summary']>('/summary'); setSummary(s!)
      showToast('Moved back to wallet.')
      onClose()
    } catch (e: unknown) {
      const err = e as { error?: { message?: string }; detail?: string }
      showToast(err?.error?.message ?? err?.detail ?? 'Could not move money out. Savings may be locked until a future date.')
    }
  }
  return (
    <BottomSheet open={open} onClose={onClose} title="Move money out of savings">
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12 }}>
        {formatMoney(maxCents)} available to move back to your wallet.
      </p>
      <AmountKeypad onConfirm={handleConfirm} maxCents={maxCents} />
    </BottomSheet>
  )
}

function LockSheet({ open, onClose, onDone, currentLock }: { open: boolean; onClose: () => void; onDone: () => void; currentLock: string | null }) {
  const [lockDate, setLockDate] = useState(currentLock ?? '')
  const [error, setError] = useState('')

  const handleSave = async () => {
    try {
      await apiFetch('/savings/lock', { method: 'PUT', body: { lock_until: lockDate || null }, idempotencyKey: newKey(), offlineFallback: true })
      await onDone()
      showToast(lockDate ? 'Savings locked.' : 'Savings unlocked.')
      onClose()
    } catch { setError('Could not update lock.') }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Lock savings">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="field">
          <label className="field-label">Unlock date (leave blank to unlock now)</label>
          <input
            value={lockDate}
            onChange={e => setLockDate(e.target.value)}
            type="date"
            min={new Date().toISOString().split('T')[0]}
            className="field-input"
          />
        </div>
        {error && <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p>}
        <button onClick={handleSave} style={{ padding: '14px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 16 }}>
          Save
        </button>
      </div>
    </BottomSheet>
  )
}