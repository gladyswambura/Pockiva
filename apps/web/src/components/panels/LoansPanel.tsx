import { useEffect, useState } from 'react'
import { EmptyState } from '@/components/Shared'
import { BottomSheet } from '@/components/BottomSheet'
import { AmountKeypad } from '@/components/AmountKeypad'
import { useStore } from '@/store'
import { showToast } from '@/components/Toast'
import { apiFetch, newKey, getToken } from '@/lib/api'
import { safeDecrypt, safeEncrypt } from '@/lib/crypto'
import { formatMoney } from '@/lib/money'
import { CreditCard, Plus } from 'lucide-react'

interface LoanState {
  id: string
  account_id: string
  lender_enc: string | null
  borrowed_cents: number
  total_repay_cents: number
  owed_cents: number
  monthly_cents: number
  due_day: number | null
  envelope_balance_cents: number
  created_at: string
}

interface LoanView extends LoanState { lenderPlain: string }

export function LoansPanel() {
  const { dek, _hasHydrated } = useStore()
  const [payLoanId, setPayLoanId] = useState<string | null>(null)
  const [showRecord, setShowRecord] = useState(false)
  const [loans, setLoans] = useState<LoanView[]>([])
  const [loading, setLoading] = useState(true)
  const token = getToken()

  const refresh = async () => {
    const raw = await apiFetch<LoanState[]>('/loans')
    const decoded: LoanView[] = await Promise.all(raw.map(async l => ({
      ...l,
      lenderPlain: l.lender_enc ? await safeDecrypt(l.lender_enc, dek) : 'Loan',
    })))
    setLoans(decoded)
    setLoading(false)
  }

  useEffect(() => {
    if (!_hasHydrated || !token) return
    refresh().catch(() => setLoading(false))
  }, [token, _hasHydrated])

  const totalOwed = loans.reduce((s, l) => s + l.owed_cents, 0)
  const totalBorrowed = loans.reduce((s, l) => s + l.borrowed_cents, 0)

  return (
    <div className="screen-content">
      {/* Crimson hero card (S13) */}
      {loans.length > 0 && (
        <div className="money-hero-card money-hero-card--loans">
          <span className="money-hero-card__label">TOTAL OWED</span>
          <strong className="money-hero-card__amount">{formatMoney(totalOwed)}</strong>
          <div className="money-hero-card__stats">
            <div className="money-hero-card__stat">
              <span>Borrowed</span>
              <b>{formatMoney(totalBorrowed)}</b>
            </div>
            <div className="money-hero-card__stat">
              <span>Loans</span>
              <b>{loans.length}</b>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-block">Loading loans…</div>
      ) : loans.length === 0 ? (
        <EmptyState
          icon={<CreditCard size={40} />}
          message="No loans recorded. Nice."
          action={
            <button
              onClick={() => setShowRecord(true)}
              className="btn btn--primary"
            >
              Record a loan
            </button>
          }
        />
      ) : (
        <>
          <h2 className="section-title">Your loans</h2>
          <div className="loans-list">
            {loans.map(l => {
              const pct = l.total_repay_cents > 0
                ? Math.min(100, ((l.borrowed_cents - l.owed_cents) / l.total_repay_cents) * 100)
                : 0
              return (
                <article key={l.id} className="loan-row-card">
                  <div className="loan-row-card__head">
                    <div className="loan-row-card__icon">
                      <CreditCard size={16} strokeWidth={2} />
                    </div>
                    <div className="loan-row-card__info">
                      <span className="loan-row-card__name">{l.lenderPlain}</span>
                      <span className="loan-row-card__meta">
                        {l.monthly_cents > 0 ? `${formatMoney(l.monthly_cents)}/mo` : 'No monthly plan'}
                        {l.due_day ? ` · day ${l.due_day}` : ''}
                      </span>
                    </div>
                    <span className="loan-row-card__owed">{formatMoney(l.owed_cents)}</span>
                  </div>
                  <div className="loan-row-card__bar">
                    <div className="loan-row-card__fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="loan-row-card__foot">
                    <span>{pct.toFixed(0)}% repaid</span>
                    <button
                      onClick={() => setPayLoanId(l.id)}
                      className="loan-row-card__pay-btn"
                    >
                      Pay
                    </button>
                  </div>
                </article>
              )
            })}
          </div>

          {/* Gold "+ Record a loan" button (S13) */}
          <button className="money-add-btn" onClick={() => setShowRecord(true)}>
            <Plus size={18} strokeWidth={2.5} /> Record a loan
          </button>
        </>
      )}

      <PayLoanSheet
        open={!!payLoanId}
        loanId={payLoanId}
        onClose={() => setPayLoanId(null)}
        onDone={refresh}
        maxCents={loans.find(l => l.id === payLoanId)?.envelope_balance_cents ?? 0}
      />
      <RecordLoanSheet open={showRecord} onClose={() => setShowRecord(false)} onDone={refresh} />
    </div>
  )
}

// ── Pay sheet ─────────────────────────────────────────────────

function PayLoanSheet({ open, loanId, onClose, onDone, maxCents }: {
  open: boolean; loanId: string | null; onClose: () => void; onDone: () => void; maxCents: number
}) {
  const handleConfirm = async (cents: number) => {
    if (!loanId) return
    try {
      await apiFetch(`/loans/${loanId}/pay`, { method: 'POST', body: { amount_cents: cents }, idempotencyKey: newKey(), offlineFallback: true })
      await onDone()
      showToast('Payment logged.')
      onClose()
    } catch { showToast('Could not log payment.') }
  }
  return (
    <BottomSheet open={open} onClose={onClose} title="Pay towards loan">
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12 }}>
        {formatMoney(maxCents)} set aside and available.
      </p>
      <AmountKeypad onConfirm={handleConfirm} maxCents={maxCents} />
    </BottomSheet>
  )
}

// ── Record loan sheet (S15) ───────────────────────────────────

function RecordLoanSheet({ open, onClose, onDone }: {
  open: boolean; onClose: () => void; onDone: () => void
}) {
  const { dek } = useStore()
  const [lender, setLender] = useState('')
  const [amount, setAmount] = useState('')
  const [monthly, setMonthly] = useState('')
  const [dueDay, setDueDay] = useState('')
  const [addToMoney, setAddToMoney] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const reset = () => { setLender(''); setAmount(''); setMonthly(''); setDueDay(''); setAddToMoney(true); setError('') }

  const handleSave = async () => {
    if (!lender.trim()) { setError('Enter the lender name.'); return }
    const amountCents = Math.round(parseFloat(amount || '0') * 100)
    if (amountCents <= 0) { setError('Enter the loan amount.'); return }
    setBusy(true)
    setError('')
    try {
      const lenderEnc = await safeEncrypt(lender.trim(), dek)
      await apiFetch('/loans', {
        method: 'POST',
        body: {
          lender_enc: lenderEnc,
          borrowed_cents: amountCents,
          total_repay_cents: amountCents,
          monthly_cents: Math.round(parseFloat(monthly || '0') * 100),
          due_day: dueDay ? parseInt(dueDay) : null,
          add_to_wallet: addToMoney,
        },
        idempotencyKey: newKey(),
      })
      await onDone()
      showToast('Loan recorded.')
      reset()
      onClose()
    } catch (e: unknown) {
      const err = e as { detail?: string }
      setError(err?.detail ?? 'Could not record loan.')
    } finally { setBusy(false) }
  }

  return (
    <BottomSheet open={open} onClose={() => { reset(); onClose() }} title="Record a loan">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="field">
          <label className="field__label">Lender (who you borrowed from)</label>
          <input value={lender} onChange={e => setLender(e.target.value)} placeholder="e.g. SACCO, Equity, Mum" className="field__input" />
        </div>
        <div className="field">
          <label className="field__label">Amount borrowed (KES)</label>
          <input value={amount} onChange={e => setAmount(e.target.value)} type="number" inputMode="numeric" placeholder="0" className="field__input" />
        </div>
        <div className="field">
          <label className="field__label">Monthly repayment (KES, optional)</label>
          <input value={monthly} onChange={e => setMonthly(e.target.value)} type="number" inputMode="numeric" placeholder="0" className="field__input" />
        </div>
        <div className="field">
          <label className="field__label">Due day of month (optional)</label>
          <input value={dueDay} onChange={e => setDueDay(e.target.value)} type="number" inputMode="numeric" placeholder="e.g. 25" min="1" max="31" className="field__input" />
        </div>

        {/* Toggle: add loan amount to wallet */}
        <div className="record-loan__toggle-row">
          <div>
            <span className="record-loan__toggle-label">Add loan amount to my money</span>
            <span className="record-loan__toggle-sub">The borrowed amount lands in your wallet to allocate.</span>
          </div>
          <button
            role="switch"
            aria-checked={addToMoney}
            onClick={() => setAddToMoney(v => !v)}
            className={`toggle-switch${addToMoney ? ' toggle-switch--on' : ''}`}
          />
        </div>

        {error && <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p>}

        <button onClick={handleSave} disabled={busy} className="btn btn--primary btn--block">
          {busy ? 'Saving…' : 'Save loan'}
        </button>
      </div>
    </BottomSheet>
  )
}
