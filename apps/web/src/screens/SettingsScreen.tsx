import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/store'
import { apiFetch } from '@/lib/api'
import { clearTokens } from '@/lib/api'
import { ConfirmDialog } from '@/components/Shared'
import { showToast } from '@/components/Toast'
import { formatMoney } from '@/lib/money'
import { BottomSheet } from '@/components/BottomSheet'

export function SettingsScreen() {
  const navigate = useNavigate()
  const { locale, currency, theme, faithContent, setPrefs, clearAuth, summary, envelopes } = useStore()
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [resetSheet, setResetSheet] = useState(false)

  const handleExport = async () => {
    try {
      const res = await fetch('/api/v1/auth/me/export', {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pockiva-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch { showToast('Could not export data.') }
  }

  const handleDelete = async () => {
    try {
      await apiFetch('/auth/me', { method: 'DELETE' })
      clearTokens()
      clearAuth()
      navigate('/welcome', { replace: true })
    } catch { showToast('Could not delete account.') }
  }

  return (
    <div className="screen-page">
      <div className="screen-heading"><div><h1>Settings</h1><p>Make Pockiva feel right for you.</p></div></div>

      <Section title="Preferences">
        <Row label="Language">
          <select value={locale} onChange={e => setPrefs({ locale: e.target.value })} style={selectStyle}>
            <option value="en">English</option>
            <option value="sw">Kiswahili</option>
          </select>
        </Row>
        <Row label="Currency">
          <select value={currency} onChange={e => setPrefs({ currency: e.target.value })} style={selectStyle}>
            <option value="KES">KES (Kenyan Shilling)</option>
            <option value="UGX">UGX (Ugandan Shilling)</option>
            <option value="TZS">TZS (Tanzanian Shilling)</option>
            <option value="USD">USD (US Dollar)</option>
          </select>
        </Row>
        <Row label="Theme">
          <select value={theme} onChange={e => setPrefs({ theme: e.target.value as 'system' | 'light' | 'dark' })} style={selectStyle}>
            <option value="system">Follow system</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </Row>
        <Row label="Faith & Scripture content">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={faithContent} onChange={e => setPrefs({ faithContent: e.target.checked })}
              style={{ width: 20, height: 20, accentColor: 'var(--color-primary)' }} />
            <span style={{ fontSize: 14 }}>Include Scripture in encouragement</span>
          </label>
        </Row>
      </Section>

      <Section title="Data">
        <button onClick={handleExport} style={btnStyle}>
          Download my data (JSON)
        </button>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>
          Export and deletion are always free, on every plan.
        </p>
      </Section>

      <Section title="Privacy promise">
        <div style={{ background: 'var(--color-info-soft)', borderRadius: 10, padding: 14, fontSize: 13, lineHeight: 1.6, color: 'var(--color-text)' }}>
          🔒 Pockiva never reads your M-Pesa, SMS or bank. Envelope names and notes are encrypted on your device before they leave. Only you hold the key.
        </div>
      </Section>

      <Section title="Balance & Data Management">
        <button onClick={() => setResetSheet(true)} style={btnStyle}>
          Reset tracking period
        </button>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4, marginBottom: 8, lineHeight: 1.5 }}>
          Archive your current records and start a fresh tracking period. Your history is preserved.
        </p>
      </Section>

      <Section title="Danger zone">
        <button onClick={() => setDeleteConfirm(true)} style={{ ...btnStyle, background: 'none', border: '1px solid var(--color-danger)', color: 'var(--color-danger)' }}>
          Delete my account and all data
        </button>
      </Section>

      <ConfirmDialog
        open={deleteConfirm}
        title="Delete account?"
        message="This will permanently delete your account and all data. This cannot be undone. Download your data first if you want a copy."
        confirmLabel="Delete everything" danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(false)}
      />

      <ResetSheet
        open={resetSheet}
        onClose={() => setResetSheet(false)}
        bankBalance={summary?.bankBalanceCents ?? 0}
        envelopeCount={envelopes.length}
      />
    </div>
  )
}

function ResetSheet({ open, onClose, bankBalance, envelopeCount }: {
  open: boolean
  onClose: () => void
  bankBalance: number
  envelopeCount: number
}) {
  const { setSummary, setEnvelopes } = useStore()
  const [step, setStep] = useState<'explain' | 'confirm'>('explain')
  const [busy, setBusy] = useState(false)

  const handleReset = async () => {
    setBusy(true)
    try {
      await apiFetch('/ledger/reset-period', { method: 'POST', body: {} })
      const s = await apiFetch<Parameters<typeof setSummary>[0]>('/summary')
      setSummary(s!)
      const envs = await apiFetch<Parameters<typeof setEnvelopes>[0]>('/envelopes')
      setEnvelopes(envs ?? [])
      showToast('Tracking period reset. Your history has been archived.')
      onClose()
    } catch {
      showToast('Could not reset. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleClose = () => { setStep('explain'); onClose() }

  return (
    <BottomSheet open={open} onClose={handleClose} title="Reset tracking period">
      {step === 'explain' ? (
        <>
          <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--color-text)', marginBottom: 14 }}>
            This will archive your current records and start a fresh period.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
            {[
              { label: 'What is preserved', value: 'All transaction history, archived for your records' },
              { label: 'What is reset', value: `Wallet balance (${formatMoney(bankBalance)}), all ${envelopeCount} envelope balances → zeroed` },
              { label: 'Your envelopes', value: 'Kept — only their balances are cleared, not deleted' },
            ].map(row => (
              <div key={row.label} style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--color-bg)', fontSize: 13 }}>
                <div style={{ fontWeight: 700, color: 'var(--color-text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>{row.label}</div>
                <div style={{ color: 'var(--color-text)', lineHeight: 1.5 }}>{row.value}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
            This is different from deleting your account. Your data stays — it is just archived so you can start fresh.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn--ghost" style={{ flex: 1 }} onClick={handleClose}>Cancel</button>
            <button
              className="btn"
              style={{ flex: 1, background: 'var(--color-warning, #B45309)', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', minHeight: 48 }}
              onClick={() => setStep('confirm')}
            >
              Continue
            </button>
          </div>
        </>
      ) : (
        <>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>
            Are you sure you want to reset?
          </p>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: 20 }}>
            Your wallet and all envelope balances will be zeroed. This period's transactions will be archived. This cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn--ghost" style={{ flex: 1 }} onClick={() => setStep('explain')}>Back</button>
            <button
              className="btn"
              style={{ flex: 1, background: 'var(--color-danger)', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', minHeight: 48, opacity: busy ? 0.6 : 1 }}
              onClick={handleReset}
              disabled={busy}
            >
              {busy ? 'Resetting…' : 'Yes, reset now'}
            </button>
          </div>
        </>
      )}
    </BottomSheet>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 'var(--space-6)' }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 12 }}>{title}</h2>
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-card)', padding: '4px 16px', boxShadow: 'var(--shadow-card)' }}>
        {children}
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid var(--color-border)' }}>
      <span style={{ fontSize: 15, fontWeight: 500 }}>{label}</span>
      {children}
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 8, border: '1px solid var(--color-border)',
  fontSize: 14, fontFamily: 'inherit', background: 'var(--color-bg)', color: 'var(--color-text)',
}

const btnStyle: React.CSSProperties = {
  width: '100%', padding: '12px', borderRadius: 10, border: 'none',
  background: 'var(--color-bg)', color: 'var(--color-text)',
  fontSize: 15, fontWeight: 600, cursor: 'pointer', textAlign: 'left',
  margin: '8px 0',
}
