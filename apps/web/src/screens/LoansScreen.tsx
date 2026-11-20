import { useT } from '@/i18n/useT'
import { LoansPanel } from '@/components/panels/LoansPanel'
import { BottomSheet } from '@/components/BottomSheet'
import { useStore } from '@/store'
import { showToast } from '@/components/Toast'
import { apiFetch, newKey } from '@/lib/api'
import { safeEncrypt } from '@/lib/crypto'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

export function LoansScreen() {
  const t = useT()
  const { dek } = useStore()
  const [showNew, setShowNew] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  // Quick action: ?action=new opens the record-loan sheet
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setShowNew(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  return (
    <div className="screen-page loans-screen">
      <header className="screen-heading">
        <div>
          <h1>{t.loans.title}</h1>
          <p>Track what you owe and pay it down steadily.</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)', border: 'none', borderRadius: 12, padding: '10px 14px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
        >
          + Record loan
        </button>
      </header>
      <LoansPanel />
      <NewLoanSheet open={showNew} onClose={() => setShowNew(false)} dek={dek} />
    </div>
  )
}

function NewLoanSheet({ open, onClose, dek }: { open: boolean; onClose: () => void; dek: CryptoKey | null }) {
  const t = useT()
  const [name, setName] = useState('')
  const [borrowed, setBorrowed] = useState('')
  const [toRepay, setToRepay] = useState('')
  const [monthly, setMonthly] = useState('')
  const [dueDay, setDueDay] = useState('')
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!name.trim()) { setError('Give the loan a name.'); return }
    if (!borrowed || !toRepay) { setError('Enter the amount borrowed and to repay.'); return }
    const borrowedCents = Math.round(parseFloat(borrowed) * 100)
    const repayCents = Math.round(parseFloat(toRepay) * 100)
    if (repayCents < borrowedCents) { setError(t.errors.repayBelowBorrowed); return }
    try {
      const lenderEnc = await safeEncrypt(name.trim(), dek)
      await apiFetch('/loans', {
        method: 'POST',
        body: {
          lender_enc: lenderEnc,
          name_enc: await safeEncrypt(name.trim(), dek),
          borrowed_cents: borrowedCents,
          total_repay_cents: repayCents,
          monthly_cents: Math.round(parseFloat(monthly || '0') * 100),
          due_day: dueDay ? parseInt(dueDay) : null,
          ring_fence: true,
        },
        idempotencyKey: newKey(),
      })
      showToast('Loan recorded.')
      setName(''); setBorrowed(''); setToRepay(''); setMonthly(''); setDueDay(''); setError('')
      onClose()
    } catch (e: unknown) {
      const err = e as { detail?: { message?: string } }
      setError(err?.detail?.message ?? 'Could not record loan.')
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Record a loan">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="field">
          <label className="field-label">Lender / source name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. M-Shwari, a friend" autoFocus className="field-input" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field">
            <label className="field-label">Amount borrowed (KES)</label>
            <input value={borrowed} onChange={e => setBorrowed(e.target.value)} type="number" placeholder="0" className="field-input" />
          </div>
          <div className="field">
            <label className="field-label">Total to repay (KES)</label>
            <input value={toRepay} onChange={e => setToRepay(e.target.value)} type="number" placeholder="0" className="field-input" />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field">
            <label className="field-label">Monthly repayment (KES)</label>
            <input value={monthly} onChange={e => setMonthly(e.target.value)} type="number" placeholder="0" className="field-input" />
          </div>
          <div className="field">
            <label className="field-label">Due day of month</label>
            <input value={dueDay} onChange={e => setDueDay(e.target.value)} type="number" min={1} max={28} placeholder="e.g. 5" className="field-input" />
          </div>
        </div>
        {error && <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p>}
        <button onClick={handleSave} style={{ padding: '14px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 16 }}>
          Record loan
        </button>
      </div>
    </BottomSheet>
  )
}