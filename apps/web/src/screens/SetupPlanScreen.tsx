import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BrandWordmark } from '@/components/BrandWordmark'
import { apiFetch, newKey } from '@/lib/api'
import { useStore } from '@/store'
import { safeEncrypt } from '@/lib/crypto'
import { showToast } from '@/components/Toast'
import { Layers, Sliders, FileText } from 'lucide-react'

const PLANS = [
  {
    id: 'blank',
    icon: FileText,
    label: 'Blank slate',
    desc: 'Start from scratch. Add your own envelopes as you go.',
    badge: null,
    color: '#596781',
    bg: '#F3F5F8',
  },
  {
    id: 'starter_50k',
    icon: Layers,
    label: 'Starter plan',
    desc: '18 ready-made envelopes for a typical KES 50,000 monthly income.',
    badge: 'Popular',
    color: '#0B2249',
    bg: '#EFF6FF',
  },
  {
    id: 'custom_income',
    icon: Sliders,
    label: 'Custom income',
    desc: 'Enter your income and we suggest a proportional split.',
    badge: null,
    color: '#C6923A',
    bg: '#FDF6E7',
  },
]

const STARTER_LABELS = [
  'Rent', 'Food', 'Transport', 'Utilities', 'Health', 'Family support',
  'Education', 'Giving', 'Loan repayment', 'Emergency fund', 'Clothing',
  'Airtime & Data', 'Toiletries', 'Eating out', 'Holiday', 'New phone', 'Miscellaneous',
]

export function SetupPlanScreen() {
  const navigate = useNavigate()
  const { dek, setIsNewUser } = useStore()
  const [selected, setSelected] = useState('starter_50k')
  const [customIncome, setCustomIncome] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleStart = async () => {
    if (selected === 'custom_income' && !customIncome.trim()) {
      setError('Enter your monthly income to continue.'); return
    }
    setError('')
    setBusy(true)
    try {
      if (selected !== 'blank') {
        const incomeCents = selected === 'custom_income' && customIncome
          ? Math.round(parseFloat(customIncome) * 100)
          : 5_000_000
        const names = await Promise.all(STARTER_LABELS.map(l => safeEncrypt(l, dek)))
        await apiFetch('/auth/setup-plan', {
          method: 'POST',
          body: { encrypted_names: names, income_cents: incomeCents, template: 'starter_50k' },
        }).catch(() => {})
        // Deposit the income so it reflects immediately on the home screen
        await apiFetch('/ledger/deposit', {
          method: 'POST',
          body: { amount_cents: incomeCents, note: 'Opening income' },
          idempotencyKey: newKey(),
        }).catch(() => {})
      }
      showToast('Welcome to Pockiva!')
      setIsNewUser(true)
      navigate('/app/', { replace: true })
    } catch {
      navigate('/app/', { replace: true })
    } finally { setBusy(false) }
  }

  return (
    <div className="auth-page">
      <button className="auth-back-btn" onClick={() => navigate(-1)} aria-label="Back">← Back</button>
      <div className="auth-card auth-card--wide">
        <div className="auth-logo" onClick={() => navigate('/', { replace: true })} role="button" tabIndex={0} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && navigate('/', { replace: true })}>
          <img src="/icon.svg" alt="Pockiva" className="auth-icon" />
          <span className="auth-wordmark"><BrandWordmark /></span>
        </div>

        <h2 className="auth-heading">How do you want to start?</h2>
        <p className="auth-sub">Pick a starting point. You can change everything later.</p>

        <div className="plan-cards">
          {PLANS.map(p => {
            const Icon = p.icon
            const active = selected === p.id
            return (
              <button
                key={p.id}
                className={`plan-card${active ? ' plan-card--active' : ''}`}
                onClick={() => setSelected(p.id)}
                aria-pressed={active}
              >
                <div className="plan-card__icon" style={{ background: p.bg, color: p.color }}>
                  <Icon size={22} strokeWidth={2} />
                </div>
                <div className="plan-card__label">
                  {p.label}
                  {p.badge && <span className="plan-card__badge">{p.badge}</span>}
                </div>
                <p className="plan-card__desc">{p.desc}</p>
                <div className={`plan-card__radio${active ? ' plan-card__radio--on' : ''}`} />
              </button>
            )
          })}
        </div>

        {selected === 'custom_income' && (
          <div className="auth-field" style={{ marginTop: 16 }}>
            <label className="auth-label" htmlFor="custom-income">Your monthly income (KES)</label>
            <input
              id="custom-income"
              value={customIncome}
              onChange={e => setCustomIncome(e.target.value)}
              type="number"
              inputMode="numeric"
              placeholder="e.g. 60000"
              className="auth-input"
            />
          </div>
        )}

        {error && <p className="auth-error" role="alert">{error}</p>}

        <button className="auth-btn-primary" onClick={handleStart} disabled={busy} style={{ marginTop: 20 }}>
          {busy ? 'Setting up…' : 'Go to Pockiva →'}
        </button>
      </div>
    </div>
  )
}
