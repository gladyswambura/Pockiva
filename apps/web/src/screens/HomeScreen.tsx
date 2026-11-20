import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useStore, type EnvelopeState } from '@/store'
import { BottomSheet } from '@/components/BottomSheet'
import { AmountKeypad } from '@/components/AmountKeypad'
import { showToast } from '@/components/Toast'
import { apiFetch, newKey, getToken } from '@/lib/api'
import { formatMoney } from '@/lib/money'
import { getMeta } from '@/lib/db'
import { safeDecrypt } from '@/lib/crypto'
import { getEnvelopeIcon } from '@/components/EnvelopeIdentityPicker'
import {
  Bell, Plus, Lock, ChevronRight, Play, Shield,
  CheckCircle2, AlertCircle, GraduationCap,
} from 'lucide-react'

function getGreeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function getDateLabel() {
  return new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' })
}

const MOB_SAYINGS = [
  'Haba na haba hujaza kibaba — little by little fills the pot.',
  'Usipoziba ufa, utajenga ukuta — plug the small leak before it becomes a wall.',
  'Spend less than you earn, every single month.',
  'Pesa ya kesho inaanza leo — tomorrow\'s money starts today.',
  'An envelope without a plan is a pocket with a hole.',
  'Akiba ya siku nyingi ndiyo utajiri — many days of saving is true wealth.',
  'Track every shilling. The small ones add up fastest.',
  'Subira huvuta heri — patience brings good fortune.',
  'A goal without a budget is just a wish.',
  'Jijengee leo, usitegemee kesho — build yourself today, don\'t wait for tomorrow.',
]

const WIDE_SAYINGS = [
  'A budget is telling your money where to go instead of wondering where it went.',
  'Do not save what is left after spending — spend what is left after saving.',
  'Beware of little expenses. A small leak will sink a great ship.',
  'Every shilling has a job. Give it one.',
  'Wealth is not about having a lot of money; it is about having a lot of options.',
  'The secret of getting ahead is getting started.',
  'Plan your spending before your spending plans you.',
  'It is not your salary that makes you rich, it is your spending habits.',
  'Financial freedom is available to those who learn about it and work for it.',
  'An investment in knowledge pays the best interest.',
]

function useSaying(pool: string[]) {
  const [idx, setIdx] = useState(() => new Date().getMinutes() % pool.length)
  useEffect(() => {
    const id = setInterval(() => setIdx(i => (i + 1) % pool.length), 3 * 60 * 1000)
    return () => clearInterval(id)
  }, [pool.length])
  return pool[idx]
}

// STATE 1: bankBalance === 0 && envelopes.length === 0  → blank (new user)
// STATE 2: bankBalance > 0  && envelopes.length === 0  → has-income (step 2)
// STATE 3: bankBalance > 0  && envelopes.length > 0    → active (daily dashboard)
// Edge:    bankBalance === 0 && envelopes.length > 0   → plan-chosen (has plan, no income yet)
type HomeState = 'blank' | 'has-income' | 'plan-chosen' | 'active'

function detectState(envelopes: EnvelopeState[], bankBalance: number): HomeState {
  if (bankBalance > 0 && envelopes.length > 0) return 'active'
  if (bankBalance > 0 && envelopes.length === 0) return 'has-income'
  if (envelopes.length > 0) return 'plan-chosen'
  return 'blank'
}

// Map snake_case API response to camelCase SummaryState
function mapSummary(raw: Record<string, number & string>): import('@/store').SummaryState {
  return {
    bankBalanceCents:    raw.bank_balance_cents,
    walletCents:         raw.wallet_cents,
    envelopesTotalCents: raw.envelopes_total_cents,
    savingsCents:        raw.savings_cents,
    totalOwedCents:      raw.total_owed_cents,
    netPositionCents:    raw.net_position_cents,
    monthlyPlanCents:    raw.monthly_plan_cents,
    stillToFundCents:    raw.still_to_fund_cents,
    currency:            raw.currency,
  }
}

export function HomeScreen() {
  const navigate = useNavigate()
  const { summary, setSummary, envelopes, setEnvelopes, dek, accessToken, _hasHydrated, isNewUser, setIsNewUser } = useStore()
  const [loading, setLoading] = useState(!summary)
  const [userName, setUserName] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const [guideSkipped, setGuideSkipped] = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const avatarRef = useRef<HTMLDivElement>(null)
  const action = searchParams.get('action')
  const token = accessToken || getToken()

  const fetchEnvelopes = async () => {
    if (!token) return
    try {
      const raw = await apiFetch<{ id: string; name_enc: string; group_code: string; color: string; icon: string; sort_order: number; plan_cents: number; goal_cents: number; balance_cents: number; funded_cents: number; spent_cents: number; lock_until: string | null; kind: string; archived_at: string | null }[]>('/envelopes')
      const currentDek = useStore.getState().dek
      const decoded: EnvelopeState[] = await Promise.all(raw.map(async e => ({
        id: e.id, nameEnc: e.name_enc ?? '', namePlain: currentDek ? await safeDecrypt(e.name_enc ?? '', currentDek) : '',
        groupCode: e.group_code ?? 'other', color: e.color ?? 'var(--env-blue)', icon: e.icon ?? 'circle',
        sortOrder: e.sort_order, planCents: e.plan_cents, goalCents: e.goal_cents,
        balanceCents: e.balance_cents, fundedCents: e.funded_cents, spentCents: e.spent_cents,
        lockUntil: e.lock_until, kind: e.kind, archivedAt: e.archived_at,
      })))
      setEnvelopes(decoded)
    } catch { /* offline */ }
  }

  const refreshMoney = async () => {
    try { const raw = await apiFetch<Record<string, number & string>>('/summary'); setSummary(mapSummary(raw)) } catch { /* offline */ }
    await fetchEnvelopes()
  }

  useEffect(() => {
    if (!_hasHydrated || !token) return
    getMeta<string>('user_name').then(v => setUserName(v ?? '')).catch(() => {})
    apiFetch<Record<string, number & string>>('/summary')
      .then(raw => { setSummary(mapSummary(raw)); setLoading(false) })
      .catch(() => setLoading(false))
    fetchEnvelopes()
  }, [token, _hasHydrated, dek])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) setAvatarOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const closeAction = () => setSearchParams({})
  const bankBalance = summary?.bankBalanceCents ?? 0
  const unallocated = summary?.walletCents ?? 0
  const homeState = detectState(envelopes, bankBalance)

  const attentionItems = (() => {
    const items: { id: string; icon: 'loan' | 'goal' | 'low' | 'unfunded'; title: string; sub: string; amount: number }[] = []
    const { loans } = useStore.getState()
    loans.forEach(l => {
      if (l.owedCents > 0 && l.monthlyCents > 0)
        items.push({ id: l.id, icon: 'loan', title: l.lenderPlain || 'Loan', sub: 'Instalment due this month', amount: l.monthlyCents })
    })
    envelopes.forEach(e => {
      if ((e.kind === 'goal' || e.groupCode === 'goals') && e.goalCents > 0 && e.balanceCents < e.goalCents)
        items.push({ id: e.id, icon: 'goal', title: e.namePlain || 'Goal', sub: 'Keep building steadily', amount: e.goalCents - e.balanceCents })
      else if (e.planCents > 0 && e.balanceCents > 0 && e.balanceCents / e.planCents < 0.2)
        items.push({ id: e.id, icon: 'low', title: e.namePlain || 'Envelope', sub: 'Running low', amount: e.balanceCents })
      else if (e.planCents > 0 && e.fundedCents === 0 && bankBalance > 0)
        items.push({ id: e.id, icon: 'unfunded', title: e.namePlain || 'Envelope', sub: 'Due this month', amount: e.planCents })
    })
    return items.slice(0, 4)
  })()
  const savings = summary?.savingsCents ?? 0
  const netPosition = summary?.netPositionCents ?? 0
  const firstName = userName.split(' ')[0] || ''

  const step1Done = bankBalance > 0
  const step2Done = envelopes.length > 0
  const step3Done = step2Done && envelopes.some(e => e.spentCents > 0)
  const showGuide = !guideSkipped && homeState !== 'active' && homeState !== 'plan-chosen'
  const showIncomeNudge = homeState === 'plan-chosen'
  const guideProgress = [step1Done, step2Done, step3Done].filter(Boolean).length
  const totalPlanCents = envelopes.reduce((s, e) => s + e.planCents, 0)
  const isReturning = homeState === 'active'
  const mobSaying = useSaying(MOB_SAYINGS)
  const wideSaying = useSaying(WIDE_SAYINGS)

  return (
    <div className="home-root">

      {/* ── WIDE top bar (≥768px) ── */}
      <header className="home-topbar">
        <div className="home-topbar__left">
          {homeState === 'active' ? (
            <>
              <h1 className="home-topbar__greeting">{getGreeting()}{firstName ? `, ${firstName}` : ''}</h1>
              <p className="home-topbar__date">{getDateLabel()}</p>
            </>
          ) : (
            <h1 className="home-topbar__greeting">Home</h1>
          )}
        </div>
        <div className="home-topbar__actions">
          <button className="home-topbar__icon-btn" aria-label="Notifications"><Bell size={20} /></button>
          <button className="home-topbar__add-btn" onClick={() => setSearchParams({ action: 'deposit' })}>
            <Plus size={16} strokeWidth={2.5} /> {bankBalance > 0 ? 'Add to wallet' : 'Add income'}
          </button>
          <div className="home-topbar__avatar-wrap" ref={avatarRef}>
            <button className="home-topbar__avatar" onClick={() => setAvatarOpen(v => !v)} aria-label="Profile menu">
              {firstName.charAt(0).toUpperCase() || 'P'}
            </button>
            {avatarOpen && (
              <div className="home-avatar-menu">
                {[
                  { label: 'Profile', action: () => navigate('/app/settings') },
                  { label: 'Settings', action: () => navigate('/app/settings') },
                  { label: 'Lock now', action: () => navigate('/lock') },
                  { label: 'Sign out', action: () => navigate('/') },
                ].map(item => (
                  <button key={item.label} className="home-avatar-menu__item" onClick={() => { item.action(); setAvatarOpen(false) }}>
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════
          MOBILE LAYOUT  (<768px)
          Rendered as a separate stacking section,
          hidden on wide via CSS.
      ══════════════════════════════════════════ */}
      <div className="mob-layout">

        {/* Mobile header */}
        <div className="mob-header">
          <div className="mob-header__greet">
            <span className="mob-header__sub">{getGreeting()}</span>
            <span className="mob-header__name">Hello{firstName ? `, ${firstName}` : ''}</span>
          </div>
          <div className="mob-header__actions">
            <button className="mob-icon-btn" aria-label="Notifications"><Bell size={18} /></button>
            <button className="mob-avatar" onClick={() => navigate('/app/settings')} aria-label="Profile">
              {firstName.charAt(0).toUpperCase() || 'P'}
            </button>
          </div>
        </div>

        {/* Navy main balance card */}
        <div className="mob-balance-card">
          <div className="mob-balance-card__label">MAIN BALANCE</div>
          <div className="mob-balance-card__value">
            {loading ? <span className="skel skel--lg" style={{ background: 'rgba(255,255,255,.2)' }} /> : formatMoney(bankBalance)}
          </div>
          {bankBalance > 0 && (
            <div style={{ fontSize: 12, opacity: .65, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
              ≈ {(bankBalance / 100 / 129).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })}
            </div>
          )}
          {bankBalance === 0 && (
            <div style={{ fontSize: 12, opacity: .7, marginTop: 6, lineHeight: 1.4 }}>
              Spending from an envelope lowers it and the envelope together: same money, stored differently.
            </div>
          )}
          <div className="mob-balance-card__tiles">
            {[
              { label: 'Unallocated', value: unallocated },
              { label: 'Savings',     value: savings },
              { label: 'Owed',        value: summary?.totalOwedCents ?? 0 },
            ].map(t => (
              <div key={t.label} className="mob-balance-tile">
                <span className="mob-balance-tile__label">{t.label}</span>
                <b className="mob-balance-tile__value">{loading ? '—' : formatMoney(t.value)}</b>
              </div>
            ))}
          </div>
        </div>

        {/* Cheer banner — rotating saying */}
        {bankBalance > 0 && (
          <div className="mob-cheer">
            {mobSaying}
          </div>
        )}

        {/* Add income / Add to wallet button */}
        <div style={{ display: 'flex', gap: 8, padding: '0 16px' }}>
          <button
            className="btn btn--primary"
            style={{ flex: 1, fontSize: 14 }}
            onClick={() => setSearchParams({ action: 'deposit' })}
          >
            + {bankBalance > 0 ? 'Add to wallet' : 'Add income'}
          </button>
        </div>

        {/* Needs attention — hide during onboarding guide */}
        {attentionItems.length > 0 && !showGuide && (
          <section className="mob-attention">
            <div className="mob-attention__header">
              <h2 className="mob-attention__title">Needs attention</h2>
              <button className="mob-attention__see-all" onClick={() => navigate('/app/envelopes')}>See all</button>
            </div>
            {attentionItems.map(item => (
              <div key={item.id} className="mob-attention__card" onClick={() => navigate('/app/envelopes')}>
                <span className={`mob-attention__icon mob-attention__icon--${item.icon}`}>
                  {item.icon === 'loan' || item.icon === 'low' ? <AlertCircle size={18} /> :
                   item.icon === 'unfunded' ? <AlertCircle size={18} /> :
                   <GraduationCap size={18} />}
                </span>
                <div className="mob-attention__body">
                  <strong>{item.title}</strong>
                  <span>{item.sub}</span>
                </div>
                <span className="mob-attention__amount">{formatMoney(item.amount)}</span>
              </div>
            ))}
          </section>
        )}

        {/* Guide: only for users with NO envelopes yet */}
        {showGuide && (
          <div className="mob-guide-card">
            <div className="mob-guide-card__header">
              <span className="mob-guide-card__title">Your first month</span>
              <button className="mob-guide-card__skip" onClick={() => setGuideSkipped(true)}>Skip</button>
            </div>
            <div className="mob-guide-card__steps">
              <MobGuideStep num={1} done={step1Done} active={!step1Done}
                title="Add your income" desc="Whatever you have received." />
              <MobGuideStep num={2} done={step2Done} active={step1Done && !step2Done}
                title="Create envelopes" desc="Start with rent or food." />
              <MobGuideStep num={3} done={step3Done} active={step2Done && !step3Done}
                title="Spend and watch" desc="Log a spend with a note." />
            </div>
            {!step1Done && (
              <button className="mob-guide-card__btn" onClick={() => setSearchParams({ action: 'deposit' })}>
                + Add income
              </button>
            )}
            {step1Done && !step2Done && (
              <>
                <button className="mob-guide-card__btn" onClick={() => navigate('/app/envelopes')}>
                  Create envelope
                </button>
                <button className="mob-guide-card__link" onClick={() => navigate('/app/envelopes?action=template')}>
                  Use the Starter Template
                </button>
              </>
            )}
            {step2Done && (
              <button className="mob-guide-card__btn" onClick={() => setSearchParams({ action: 'spend' })}>
                Log a spend
              </button>
            )}
          </div>
        )}

        {/* Income nudge: has envelopes but no income yet */}
        {showIncomeNudge && (
          <div className="mob-income-nudge">
            <span className="mob-income-nudge__text">Your plan is ready. Add your income and we'll fill it.</span>
            <button className="btn btn--primary" style={{ marginTop: 10, width: '100%' }} onClick={() => setSearchParams({ action: 'deposit' })}>
              + Add income
            </button>
          </div>
        )}

        {/* Envelopes section heading */}
        <div className="mob-section-header">
          <span className="mob-section-header__title">My envelopes</span>
          {envelopes.length > 0 && (
            <button className="mob-section-header__link" onClick={() => navigate('/app/envelopes')}>
              Open
            </button>
          )}
        </div>

        {/* Empty state — always show when no envelopes */}
        {envelopes.length === 0 && (
          <div className="mob-empty-card">
            <div className="mob-empty-card__icon-tile">✉</div>
            <p className="mob-empty-card__sub">No envelopes created.</p>
          </div>
        )}

        {/* S23: plan-chosen envelope rows */}
        {envelopes.length > 0 && homeState === 'plan-chosen' && (
          <div className="mob-env-list">
            {envelopes.map(e => <WaitingEnvRow key={e.id} envelope={e} onClick={() => navigate('/app/envelopes')} />)}
          </div>
        )}

        {/* S06v2: active envelope horizontal scroll cards */}
        {envelopes.length > 0 && homeState === 'active' && (
          <div className="mob-env-scroll">
            {envelopes.slice(0, 8).map(e => <MobEnvCard key={e.id} envelope={e} onClick={() => navigate('/app/envelopes')} />)}
          </div>
        )}

        <div style={{ height: 24 }} />
      </div>

      {/* ══════════════════════════════════════════
          WIDE LAYOUT  (≥768px)
      ══════════════════════════════════════════ */}
      <div className="wide-layout">

        {/* Wide summary cards */}
        <section className="home-summary-row" aria-label="Money summary">
          {[
            { label: 'MAIN BALANCE',      value: bankBalance, extra: bankBalance > 0 ? 'Spending from an envelope lowers it and the envelope together: same money, stored differently.' : 'Add income to begin' },
            { label: 'UNALLOCATED',        value: unallocated, extra: 'Drag me onto an envelope to allocate' },
            { label: 'PROTECTED SAVINGS',  value: savings, extra: null },
            { label: 'NET POSITION',       value: netPosition, extra: null },
          ].map(card => (
            <div key={card.label} className="home-summary-card">
              <div className="home-summary-card__label">{card.label}</div>
              {loading
                ? <div className="skel skel--lg" style={{ marginTop: 8 }} />
                : <>
                    <div className="home-summary-card__value">{formatMoney(card.value)}</div>
                    {card.label === 'MAIN BALANCE' && card.value > 0 && (
                      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
                        ≈ {(card.value / 100 / 129).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })}
                      </div>
                    )}
                  </>
              }
              {card.extra && <div className="home-summary-card__hint">{card.extra}</div>}
            </div>
          ))}
        </section>

        {/* Wide welcome / context banner */}
        {isNewUser && homeState === 'blank' && (
          <div className="home-welcome-banner">
            <div className="home-welcome-banner__left">
              <h2 className="home-welcome-banner__heading">
                Welcome{firstName ? `, ${firstName}` : ''}. Let's give every shilling a place.
              </h2>
              <p className="home-welcome-banner__sub">It takes about two minutes. You can change anything later.</p>
            </div>
            <div className="home-welcome-banner__right">
              <div className="home-welcome-banner__progress-label">
                <span>Your first month</span>
                <span>{guideProgress} of 3</span>
              </div>
              <div className="home-welcome-banner__track">
                <div className="home-welcome-banner__fill" style={{ width: `${(guideProgress / 3) * 100}%` }} />
              </div>
              <button
                style={{ marginTop: 8, fontSize: 12, color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                onClick={() => setIsNewUser(false)}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {isNewUser && homeState === 'has-income' && (
          <div className="home-welcome-banner">
            <div className="home-welcome-banner__left">
              <h2 className="home-welcome-banner__heading">
                Income added{firstName ? `, ${firstName}` : ''}. Now create your envelopes.
              </h2>
              <p className="home-welcome-banner__sub">Start with rent, food or transport — whatever you pay every month.</p>
            </div>
            <div className="home-welcome-banner__right">
              <div className="home-welcome-banner__progress-label">
                <span>Your first month</span>
                <span>{guideProgress} of 3</span>
              </div>
              <div className="home-welcome-banner__track">
                <div className="home-welcome-banner__fill" style={{ width: `${(guideProgress / 3) * 100}%` }} />
              </div>
            </div>
          </div>
        )}

        {homeState === 'plan-chosen' && (
          <div className="home-welcome-banner">
            <div className="home-welcome-banner__left">
              <h2 className="home-welcome-banner__heading">
                Your plan is set{firstName ? `, ${firstName}` : ''}. Now add your income.
              </h2>
              <p className="home-welcome-banner__sub">Once you add income, we'll fill your envelopes automatically.</p>
            </div>
            <div className="home-welcome-banner__right">
              <div className="home-welcome-banner__progress-label">
                <span>Your first month</span>
                <span>{guideProgress} of 3</span>
              </div>
              <div className="home-welcome-banner__track">
                <div className="home-welcome-banner__fill" style={{ width: `${(guideProgress / 3) * 100}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* Returning user banner */}
        {isReturning && (
          <div className="home-welcome-banner">
            <div className="home-welcome-banner__left">
              <h2 className="home-welcome-banner__heading">Every shilling has a place.</h2>
              <p className="home-welcome-banner__sub">Less guessing. More financial clarity.</p>
            </div>
            <div className="home-welcome-banner__right">
              <p style={{ fontSize: 14, fontStyle: 'italic', color: '#F5F0EB', margin: 0, lineHeight: 1.6, fontWeight: 500 }}>
                “{wideSaying}”
              </p>
            </div>
          </div>
        )}

        {showGuide && (
          <section className="home-guide" aria-labelledby="guide-heading">
            <div className="home-guide__header">
              <h2 id="guide-heading" className="home-guide__title">Your first month</h2>
              <button className="home-guide__skip" onClick={() => setGuideSkipped(true)}>Skip this guide</button>
            </div>
            <div className="home-guide__cards">
              <GuideCard step={1} done={step1Done} active={!step1Done}
                title="Add your income" desc="Whatever you have received. It lands in Unallocated."
                actionLabel="Add income" onAction={() => setSearchParams({ action: 'deposit' })} />
              <GuideCard step={2} done={step2Done} active={step1Done && !step2Done}
                title="Create envelopes"
                desc="Start with rent, food or transport."
                actionLabel="Create envelope"
                secondaryLabel="Use the Starter Template"
                onAction={() => navigate('/app/envelopes')}
                onSecondary={() => navigate('/app/envelopes?action=template')} />
              <GuideCard step={3} done={step3Done} active={step2Done && !step3Done}
                title="Spend and watch" desc="Record spending with a note and watch the envelope go down."
                actionLabel="Log a spend" onAction={() => setSearchParams({ action: 'spend' })} />
            </div>
          </section>
        )}

        {/* Wide income nudge — has envelopes but no income yet */}
        {showIncomeNudge && (
          <div className="home-income-nudge">
            <div>
              <strong>Your plan is ready.</strong>
              <span style={{ marginLeft: 8, color: 'var(--color-text-muted)', fontSize: 14 }}>Add your income and we'll fill your envelopes.</span>
            </div>
            <button className="btn btn--primary" onClick={() => setSearchParams({ action: 'deposit' })}>+ Add income</button>
          </div>
        )}

        {/* Wide needs attention */}
        {attentionItems.length > 0 && (
          <section className="home-attention" aria-label="Needs attention">
            <div className="home-attention__header">
              <h2 className="home-attention__title">Needs attention</h2>
              <button className="home-attention__see-all" onClick={() => navigate('/app/envelopes')}>See all</button>
            </div>
            <div className="home-attention__list">
              {attentionItems.map(item => (
                <div key={item.id} className="home-attention__card" onClick={() => navigate('/app/envelopes')}>
                  <span className={`home-attention__icon home-attention__icon--${item.icon}`}>
                    {item.icon === 'loan' || item.icon === 'low' ? <AlertCircle size={16} /> : <GraduationCap size={16} />}
                  </span>
                  <div className="home-attention__body">
                    <strong>{item.title}</strong>
                    <span>{item.sub}</span>
                  </div>
                  <span className="home-attention__amount">{formatMoney(item.amount)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Wide envelopes section */}
        <section className="home-envelopes" aria-labelledby="envelopes-heading">
          <div className="home-envelopes__header">
            <div>
              <h2 id="envelopes-heading" className="home-envelopes__title">Your envelopes</h2>
              {homeState === 'plan-chosen' && totalPlanCents > 0 && (
                <p className="home-envelopes__sub">Starter plan, planned {formatMoney(totalPlanCents)}</p>
              )}
            </div>
            {envelopes.length > 0 && (
              <button className="home-envelopes__edit" onClick={() => navigate('/app/envelopes')}>
                {homeState === 'plan-chosen' ? 'Edit plan' : `${envelopes.length} envelopes`}
              </button>
            )}
          </div>

          {envelopes.length === 0 ? (
            <div className="home-empty-card">
              <div className="home-empty-card__icon">✉</div>
              <p className="home-empty-card__sub">No envelopes created.</p>
            </div>
          ) : homeState === 'active' ? (
            <div className="home-env-grid">
              {envelopes.slice(0, 6).map(e => <WideEnvCard key={e.id} envelope={e} onClick={() => navigate('/app/envelopes')} />)}
            </div>
          ) : (
            <div className="home-env-grid">
              {envelopes.slice(0, 6).map(e => <WaitingEnvCard key={e.id} envelope={e} onClick={() => navigate('/app/envelopes')} />)}
            </div>
          )}
        </section>

        {/* Wide help cards */}
        <section className="home-help-row" aria-label="Help and information">
          <div className="home-help-card">
            <span className="home-help-card__icon" style={{ background: '#EFF6FF', color: '#2563EB' }}>
              <Play size={20} />
            </span>
            <div className="home-help-card__body">
              <strong>Watch the 90-second demo</strong>
              <span>See how the maths works before you start.</span>
            </div>
            <button className="home-help-card__action" onClick={() => navigate('/demo')}>Play <ChevronRight size={14} /></button>
          </div>
          <div className="home-help-card">
            <span className="home-help-card__icon" style={{ background: '#E3F5ED', color: '#2E9E6B' }}>
              <Shield size={20} />
            </span>
            <div className="home-help-card__body">
              <strong>How we keep your data private</strong>
              <span>Names and notes are encrypted on your device.</span>
            </div>
            <button className="home-help-card__action">Read <ChevronRight size={14} /></button>
          </div>
        </section>

      </div>{/* end wide-layout */}

      {/* Sheets */}
      <DepositSheet open={action === 'deposit'} onClose={closeAction} onDone={refreshMoney} bankBalance={bankBalance} />
      <SpendSheet open={action === 'spend'} envelopes={envelopes} onClose={closeAction} onDone={refreshMoney} />
    </div>
  )
}

// ── Mobile guide step ─────────────────────────────────────────

function MobGuideStep({ num, done, active, title, desc }: {
  num: number; done: boolean; active: boolean; title: string; desc: string
}) {
  return (
    <div className="mob-guide-step">
      <span className={`mob-guide-step__badge${active ? ' mob-guide-step__badge--active' : done ? ' mob-guide-step__badge--done' : ''}`}>
        {done ? '✓' : num}
      </span>
      <div className="mob-guide-step__body">
        <div className={`mob-guide-step__title${!active && !done ? ' mob-guide-step__title--muted' : ''}`}>{title}</div>
        <div className="mob-guide-step__desc">{desc}</div>
      </div>
      {!active && !done && <span className="mob-guide-step__lock" aria-hidden>🔒</span>}
    </div>
  )
}

// ── Mobile waiting envelope row (S23) ─────────────────────────

function WaitingEnvRow({ envelope: e, onClick }: { envelope: EnvelopeState; onClick: () => void }) {
  const Icon = getEnvelopeIcon(e.icon.toLowerCase())
  return (
    <button className="mob-env-row" style={{ borderLeftColor: e.color }} onClick={onClick}
      aria-label={`${e.namePlain || 'Envelope'}, waiting for income`}>
      <span className="icon-tile" style={{ background: `color-mix(in srgb, ${e.color} 14%, #fff)`, color: e.color }}>
        <Icon size={20} />
      </span>
      <div className="mob-env-row__main">
        <span className="mob-env-row__name">{e.namePlain || '···'}</span>
        {e.planCents > 0 && <span className="mob-env-row__plan">of {formatMoney(e.planCents)} plan</span>}
        <div className="mob-env-row__progress"><div className="mob-env-row__progress-fill" style={{ width: '0%' }} /></div>
        <span className="mob-env-row__tag">Waiting for income</span>
      </div>
      <span className="mob-env-row__amount">{formatMoney(0)}</span>
    </button>
  )
}

// ── Wide guide card ───────────────────────────────────────────

function GuideCard({ step, done, active, title, desc, actionLabel, onAction, secondaryLabel, onSecondary }: {
  step: number; done: boolean; active: boolean
  title: string; desc: string; actionLabel: string; onAction: () => void
  secondaryLabel?: string; onSecondary?: () => void
}) {
  return (
    <div className={`guide-card${active ? ' guide-card--active' : ''}${done ? ' guide-card--done' : ''}`}>
      <div className="guide-card__top">
        <span className={`guide-card__badge${active ? ' guide-card__badge--active' : done ? ' guide-card__badge--done' : ''}`}>
          {done ? <CheckCircle2 size={16} /> : step}
        </span>
        <strong className="guide-card__title">{title}</strong>
      </div>
      <p className="guide-card__desc">{desc}</p>
      <button
        className={`guide-card__btn${active ? ' guide-card__btn--active' : ''}`}
        onClick={onAction}
        disabled={!active && !done}
      >
        {!active && !done && <Lock size={13} style={{ marginRight: 5 }} />}
        {actionLabel}
      </button>
      {secondaryLabel && onSecondary && active && (
        <button
          className="guide-card__secondary"
          onClick={onSecondary}
        >
          {secondaryLabel}
        </button>
      )}
    </div>
  )
}

// ── Wide waiting envelope card ────────────────────────────────

function WaitingEnvCard({ envelope: e, onClick }: { envelope: EnvelopeState; onClick: () => void }) {
  const Icon = getEnvelopeIcon(e.icon.toLowerCase())
  return (
    <button className="env-card" onClick={onClick} aria-label={`${e.namePlain || 'Envelope'}, waiting for income`}>
      <div className="env-card__strip" style={{ background: e.color }} />
      <div className="env-card__body">
        <span className="icon-tile" style={{ background: `color-mix(in srgb, ${e.color} 14%, var(--color-surface))`, color: e.color }}>
          <Icon size={20} />
        </span>
        <span className="env-card__main">
          <span className="env-card__name">{e.namePlain || '···'}</span>
          <div className="progress"><div className="progress__fill" style={{ width: '0%' }} /></div>
          <span className="tag tag--waiting">Waiting for income</span>
        </span>
        <span className="env-card__amount">
          <span className="env-card__balance">{formatMoney(0)}</span>
          {e.planCents > 0 && <span className="env-card__plan">of {formatMoney(e.planCents)}</span>}
        </span>
      </div>
    </button>
  )
}

// ── Wide active envelope card ─────────────────────────────────

function WideEnvCard({ envelope: e, onClick }: { envelope: EnvelopeState; onClick: () => void }) {
  const pct = e.planCents > 0 ? Math.min(100, (e.fundedCents / e.planCents) * 100) : 0
  const Icon = getEnvelopeIcon(e.icon.toLowerCase())
  return (
    <button className="env-card" onClick={onClick} aria-label={`${e.namePlain || 'Envelope'}: ${formatMoney(e.balanceCents)}`}>
      <div className="env-card__strip" style={{ background: e.color }} />
      <div className="env-card__body">
        <span className="icon-tile" style={{ background: `color-mix(in srgb, ${e.color} 14%, var(--color-surface))`, color: e.color }}>
          <Icon size={20} />
        </span>
        <span className="env-card__main">
          <span className="env-card__name">{e.namePlain || '···'}</span>
          {e.planCents > 0 && <div className="progress"><div className="progress__fill" style={{ width: `${pct}%`, background: e.color }} /></div>}
        </span>
        <span className="env-card__amount">
          <span className="env-card__balance">{formatMoney(e.balanceCents)}</span>
          {e.planCents > 0 && <span className="env-card__plan">of {formatMoney(e.planCents)}</span>}
        </span>
      </div>
    </button>
  )
}

// ── Mobile horizontal envelope card (S06v2 active) ──────────

function MobEnvCard({ envelope: e, onClick }: { envelope: EnvelopeState; onClick: () => void }) {
  const Icon = getEnvelopeIcon(e.icon.toLowerCase())
  const pct = e.planCents > 0 ? Math.min(100, (e.balanceCents / e.planCents) * 100) : 0
  return (
    <button className="mob-env-card" style={{ borderTopColor: e.color }} onClick={onClick}
      aria-label={`${e.namePlain || 'Envelope'}: ${formatMoney(e.balanceCents)}`}>
      <span className="mob-env-card__icon" style={{ background: `color-mix(in srgb, ${e.color} 14%, #fff)`, color: e.color }}>
        <Icon size={22} />
      </span>
      {e.planCents > 0 && (
        <div className="mob-env-card__bar">
          <div className="mob-env-card__bar-fill" style={{ width: `${pct}%`, background: e.color }} />
        </div>
      )}
      <span className="mob-env-card__amount">{formatMoney(e.balanceCents)}</span>
    </button>
  )
}

// ── Deposit sheet ─────────────────────────────────────────────

function DepositSheet({ open, onClose, onDone, bankBalance }: { open: boolean; onClose: () => void; onDone: () => void; bankBalance: number }) {
  const navigate = useNavigate()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (open) setNote('') }, [open])

  const handleConfirm = async (cents: number, fillEnvelopes = false) => {
    setBusy(true)
    try {
      await apiFetch('/ledger/deposit', { method: 'POST', body: { amount_cents: cents, note: note || undefined }, idempotencyKey: newKey() })
      await onDone()
      showToast(`${formatMoney(cents)} added to Unallocated.`)
      onClose()
      if (fillEnvelopes) navigate('/app/envelopes?action=fundall')
    } catch (e: unknown) {
      const err = e as { detail?: { message?: string }; error?: { message?: string } }
      showToast(err?.detail?.message ?? err?.error?.message ?? 'Could not save. Try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <BottomSheet open={open} onClose={onClose} title={bankBalance > 0 ? 'Add to wallet' : 'Add income'}>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12 }}>
        Money lands in Unallocated. Assign it to envelopes when you're ready.
      </p>
      <div className="field" style={{ marginBottom: 12 }}>
        <label className="field__label">Note (optional)</label>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Salary, customer payment, gift" className="field__input" />
      </div>
      <AmountKeypad
        onConfirm={handleConfirm}
        confirmLabel={busy ? 'Saving…' : 'Save'}
        onSecondary={cents => handleConfirm(cents, true)}
        secondaryLabel="Save and fill my envelopes"
      />
    </BottomSheet>
  )
}

// ── Spend sheet ───────────────────────────────────────────────

function SpendSheet({ open, envelopes, onClose, onDone }: { open: boolean; envelopes: EnvelopeState[]; onClose: () => void; onDone: () => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const envelope = envelopes.find(e => e.id === selected) ?? null
  useEffect(() => { if (open) { setSelected(envelopes[0]?.id ?? null); setNote('') } }, [open])
  const handleConfirm = async (cents: number) => {
    if (!envelope) return
    try {
      await apiFetch('/ledger/spend', { method: 'POST', body: { account_id: envelope.id, amount_cents: cents, note }, idempotencyKey: newKey(), offlineFallback: true })
      showToast(`Spent ${formatMoney(cents)} from ${envelope.namePlain}.`)
      onDone(); onClose()
    } catch { showToast('Could not log spend.') }
  }
  return (
    <BottomSheet open={open} onClose={onClose} title="Log a spend">
      {!envelope ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>No envelopes with a balance yet.</p>
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}>Envelope</label>
            <select value={selected ?? ''} onChange={e => setSelected(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--color-border)', fontSize: 15, fontFamily: 'inherit', background: 'var(--color-bg)', color: 'var(--color-text)' }}>
              {envelopes.filter(e => e.balanceCents > 0).map(e => <option key={e.id} value={e.id}>{e.namePlain} — {formatMoney(e.balanceCents)}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}>What was it for?</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Naivas, matatu fare"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--color-border)', fontSize: 15, fontFamily: 'inherit', background: 'var(--color-bg)', color: 'var(--color-text)' }} />
          </div>
          <AmountKeypad onConfirm={handleConfirm} maxCents={envelope.balanceCents} label={`Spend from ${envelope.namePlain} (KES)`} />
        </>
      )}
    </BottomSheet>
  )
}
