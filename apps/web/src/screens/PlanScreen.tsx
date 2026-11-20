import { useEffect, useState } from 'react'
import { useT } from '@/i18n/useT'
import { Wallet, CreditCard, PiggyBank, AlertCircle, ArrowRight, Crown, Check, Zap, Users } from 'lucide-react'
import { useStore } from '@/store'
import { formatMoney } from '@/lib/money'
import { apiFetch, getToken } from '@/lib/api'
import { showToast } from '@/components/Toast'
import { BottomSheet } from '@/components/BottomSheet'

export function PlanScreen() {
  const t = useT()
  const { summary, planTier } = useStore()

  const bankBalance = summary?.bankBalanceCents ?? 0
  const wallet = summary?.walletCents ?? 0
  const envelopes = summary?.envelopesTotalCents ?? 0
  const savings = summary?.savingsCents ?? 0
  const debts = summary?.totalOwedCents ?? 0
  const netPosition = summary?.netPositionCents ?? 0

  const planItems = [
    {
      id: 'wallet',
      icon: Wallet,
      label: t.home.wallet,
      amount: wallet,
      color: 'var(--color-accent)',
      description: 'Available to allocate',
    },
    {
      id: 'envelopes',
      icon: CreditCard,
      label: t.home.inEnvelopes,
      amount: envelopes,
      color: 'var(--color-success)',
      description: 'Active spending envelopes',
    },
    {
      id: 'savings',
      icon: PiggyBank,
      label: t.home.savings,
      amount: savings,
      color: 'var(--color-info)',
      description: 'Protected savings',
    },
    {
      id: 'debts',
      icon: AlertCircle,
      label: t.home.debtsOwed,
      amount: debts,
      color: 'var(--color-danger)',
      description: 'Loans & debts owed',
    },
  ]

  return (
    <div className="screen-page plan-screen" data-testid="plan-screen">
      <header className="screen-heading">
        <div>
          <h1>{t.plan.title}</h1>
          <p>Where your money sits, all in one view.</p>
        </div>
      </header>

      <section className="screen-content">
        {/* Net Position Card */}
        <div className={`summary-card net-position ${netPosition >= 0 ? 'positive' : 'negative'}`}>
          <div className="card-header">
            <span className="card-label">{t.home.netPosition}</span>
          </div>
          <div className="card-value">{formatMoney(Math.abs(netPosition))}</div>
          <div className="card-sub">{netPosition >= 0 ? 'You own more than you owe' : 'You owe more than you own'}</div>
        </div>

        {/* Bank Balance Card */}
        <div className="summary-card bank-balance">
          <div className="card-header">
            <span className="card-label">{t.home.bankBalance}</span>
          </div>
          <div className="card-value">{formatMoney(bankBalance)}</div>
          <div className="card-sub">Wallet + Envelopes + Savings</div>
        </div>

        {/* Plan Breakdown */}
        <div className="plan-breakdown">
          <h2 className="section-title">Your Money Plan</h2>
          <div className="plan-grid">
            {planItems.map(item => (
              <PlanCard key={item.id} {...item} />
            ))}
          </div>
        </div>

        {/* Subscription */}
        <SubscriptionSection currentTier={planTier} />
      </section>
    </div>
  )
}

function PlanCard({ icon: Icon, label, amount, color, description }: {
  icon: React.ComponentType<{ size?: number }>
  label: string
  amount: number
  color: string
  description: string
}) {
  const percentage = 0

  return (
    <div className="plan-card" style={{ '--item-color': color } as React.CSSProperties}>
      <div className="plan-card-header">
        <div className="plan-card-icon" style={{ backgroundColor: color }}>
          <Icon size={20} />
        </div>
        <div>
          <div className="plan-card-label">{label}</div>
          <div className="plan-card-desc">{description}</div>
        </div>
      </div>
      <div className="plan-card-value">{formatMoney(amount)}</div>
      <div className="plan-card-progress">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${percentage}%`, backgroundColor: color }} />
        </div>
        <span className="progress-text">{percentage}% funded</span>
      </div>
    </div>
  )
}

const TIERS = [
  {
    id: 'free',
    name: 'Free',
    icon: Wallet,
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      'Up to 5 envelopes',
      '1 savings wallet',
      '1 device sync',
      'Data export',
    ],
  },
  {
    id: 'plus',
    name: 'Plus',
    icon: Zap,
    priceMonthly: 9900,
    priceYearly: 99000,
    features: [
      'Unlimited envelopes',
      '3 savings wallets',
      'Loan payoff plans',
      '3 device sync',
      'Priority support',
    ],
    highlight: true,
  },
  {
    id: 'family',
    name: 'Family',
    icon: Users,
    priceMonthly: 24900,
    priceYearly: 249000,
    features: [
      'Everything in Plus',
      'Shared envelopes',
      '5 device sync',
      'Family budgeting',
    ],
  },
]

interface SubState {
  tier: string
  status: string
  trial_ends_at: string | null
  current_period_end: string | null
  billing: string | null
}

function SubscriptionSection({ currentTier }: { currentTier: string }) {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [sub, setSub] = useState<SubState | null>(null)
  const [checkout, setCheckout] = useState<{ tier: string } | null>(null)
  const setPlanTier = useStore(s => s.setPlanTier)

  const refreshSub = async () => {
    if (!getToken()) return
    try {
      const s = await apiFetch<SubState>('/subscription')
      setSub(s)
      if (s.status === 'active' && s.tier !== 'free') setPlanTier(s.tier)
    } catch { /* not signed in / offline */ }
  }

  useEffect(() => { refreshSub() }, [])

  const trialDays = sub?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / 86_400_000))
    : null

  return (
    <section className="subscription-section" style={{ marginTop: 'var(--space-6)' }}>
      <div className="section-heading">
        <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Crown size={20} color="var(--color-accent)" /> Pockiva Plan
        </h2>
        {currentTier !== 'free' && (
          <span className="tag tag--success">Current: {currentTier}</span>
        )}
      </div>

      {/* Trial / grace status */}
      {sub?.status === 'trialing' && trialDays !== null && (
        <p className="banner" style={{ marginBottom: 16 }}>
          Free trial: {trialDays} day{trialDays !== 1 ? 's' : ''} left. Choose a plan below to keep using Pockiva.
        </p>
      )}
      {sub?.status === 'grace' && (
        <p className="banner" style={{ marginBottom: 16, background: 'var(--tag-debt-bg)', borderColor: 'var(--tag-debt-text)', color: 'var(--tag-debt-text)' }}>
          Payment overdue: renew to avoid losing access.
        </p>
      )}

      {/* Billing toggle */}
      <div className="billing-toggle" role="tablist" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          role="tab"
          aria-selected={billing === 'monthly'}
          onClick={() => setBilling('monthly')}
          style={{
            padding: '8px 16px', borderRadius: 8, border: '1px solid var(--color-border)',
            background: billing === 'monthly' ? 'var(--color-primary)' : 'var(--color-surface)',
            color: billing === 'monthly' ? 'var(--color-on-primary)' : 'var(--color-text)',
            fontWeight: 600, cursor: 'pointer', minHeight: 44,
          }}
        >
          Monthly
        </button>
        <button
          role="tab"
          aria-selected={billing === 'yearly'}
          onClick={() => setBilling('yearly')}
          style={{
            padding: '8px 16px', borderRadius: 8, border: '1px solid var(--color-border)',
            background: billing === 'yearly' ? 'var(--color-primary)' : 'var(--color-surface)',
            color: billing === 'yearly' ? 'var(--color-on-primary)' : 'var(--color-text)',
            fontWeight: 600, cursor: 'pointer', minHeight: 44,
          }}
        >
          Yearly <span style={{ fontSize: 11, opacity: .8 }}>(2 months free)</span>
        </button>
      </div>

      <div className="plan-grid">
        {TIERS.map(tier => {
          const isCurrent = tier.id === currentTier
          const price = billing === 'monthly' ? tier.priceMonthly : tier.priceYearly
          const period = billing === 'monthly' ? '/mo' : '/yr'

          return (
            <article
              key={tier.id}
              className="plan-card"
              style={{
                '--item-color': tier.highlight ? 'var(--color-accent)' : 'var(--color-primary)',
                border: tier.highlight ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                position: 'relative',
              } as React.CSSProperties}
            >
              {tier.highlight && (
                <span className="tag tag--warning" style={{ position: 'absolute', top: 8, right: 8 }}>
                  Most popular
                </span>
              )}
              {isCurrent && (
                <span className="tag tag--success" style={{ position: 'absolute', top: 8, right: 8 }}>
                  Current
                </span>
              )}

              <div className="plan-card-header">
                <div className="plan-card-icon" style={{ backgroundColor: tier.highlight ? 'var(--color-accent)' : 'var(--color-primary)' }}>
                  <tier.icon size={20} />
                </div>
                <div>
                  <div className="plan-card-label">{tier.name}</div>
                </div>
              </div>

              <div className="plan-card-value">
                {price === 0 ? 'Free' : `${formatMoney(price)}${period}`}
              </div>

              <ul className="plan-features">
                {tier.features.map(f => (
                  <li key={f}>
                    <Check size={14} color="var(--color-success)" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {!isCurrent && tier.id !== 'free' && (
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: 12, minHeight: 44 }}
                  onClick={() => setCheckout({ tier: tier.id })}
                >
                  <ArrowRight size={16} /> Choose {tier.name}
                </button>
              )}
              {isCurrent && (
                <button
                  className="btn btn--ghost"
                  disabled
                  style={{ width: '100%', marginTop: 12, minHeight: 44, opacity: .6 }}
                >
                  Current plan
                </button>
              )}
            </article>
          )
        })}
      </div>

      <CheckoutSheet
        open={checkout !== null}
        tier={checkout?.tier ?? ''}
        billing={billing}
        onClose={() => setCheckout(null)}
        onPaid={() => { setCheckout(null); refreshSub() }}
      />
    </section>
  )
}

// ── M-Pesa checkout sheet ─────────────────────────────────────

function CheckoutSheet({ open, tier, billing, onClose, onPaid }: {
  open: boolean
  tier: string
  billing: 'monthly' | 'yearly'
  onClose: () => void
  onPaid: () => void
}) {
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { if (open) { setPhone(''); setError(''); setBusy(false) } }, [open])

  const handlePay = async () => {
    const digits = phone.replace(/[\s-]/g, '')
    if (!/^(\+?254|0)7\d{8}$/.test(digits)) { setError('Enter a valid M-Pesa number, e.g. 0712 345 678.'); return }
    setBusy(true)
    setError('')
    try {
      const res = await apiFetch<{ message: string }>('/subscription/checkout', {
        method: 'POST',
        body: { tier, billing, phone: digits },
      })
      showToast(res.message)
      // Poll for payment confirmation (STK push callback → subscription active)
      for (let i = 0; i < 24; i++) {
        await new Promise(r => setTimeout(r, 5000))
        const sub = await apiFetch<{ tier: string; status: string }>('/subscription').catch(() => null)
        if (sub?.status === 'active' && sub.tier === tier) {
          showToast(`${tier[0].toUpperCase() + tier.slice(1)} is now active.`)
          onPaid()
          return
        }
      }
      showToast('Payment not confirmed yet. You can check back later.')
      onPaid()
    } catch (e: unknown) {
      const err = e as { detail?: { message?: string } }
      setError(err?.detail?.message ?? 'Could not start payment.')
      setBusy(false)
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={`Subscribe to ${tier}`}>
      <p className="sheet-sub">Pay securely with M-Pesa. You'll get a prompt on your phone to enter your PIN.</p>
      <div className="field">
        <label className="field__label" htmlFor="mpesa-phone">M-Pesa phone number</label>
        <input
          id="mpesa-phone"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="0712 345 678"
          inputMode="tel"
          autoFocus
          className="field__input"
          style={{ marginTop: 6 }}
        />
      </div>
      {error && <p style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 10 }}>{error}</p>}
      <button className="btn btn--primary btn--block" style={{ marginTop: 16 }} onClick={handlePay} disabled={busy}>
        {busy ? 'Waiting for M-Pesa…' : 'Pay with M-Pesa'}
      </button>
    </BottomSheet>
  )
}