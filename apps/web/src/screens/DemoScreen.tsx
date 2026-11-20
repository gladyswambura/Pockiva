import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDownToLine, ArrowLeftRight, Banknote, ChevronRight, CircleHelp, House, Layers, Plus, ShoppingCart, Wallet, X } from 'lucide-react'
import { MoneyText } from '@/components/MoneyText'
import { ProgressBar } from '@/components/ProgressBar'
import { Tag } from '@/components/Tag'
import { BrandWordmark } from '@/components/BrandWordmark'
import { envelopeColors } from '@/lib/tokens'

interface DemoEnvelope {
  id: string
  name: string
  group: string
  color: string
  icon: typeof House
  plan: number
  balance: number
  spent: number
}

const INITIAL_ENVELOPES: DemoEnvelope[] = [
  { id: 'rent', name: 'Rent', group: 'Essentials', color: envelopeColors[0], icon: House, plan: 1_500_000, balance: 1_500_000, spent: 0 },
  { id: 'food', name: 'Food', group: 'Essentials', color: envelopeColors[7], icon: ShoppingCart, plan: 1_200_000, balance: 1_200_000, spent: 0 },
  { id: 'transport', name: 'Transport', group: 'Essentials', color: envelopeColors[5], icon: ArrowLeftRight, plan: 800_000, balance: 800_000, spent: 0 },
  { id: 'school', name: 'School fees', group: 'Education', color: envelopeColors[2], icon: Layers, plan: 500_000, balance: 500_000, spent: 0 },
  { id: 'savings', name: 'Savings goal', group: 'Savings', color: envelopeColors[11], icon: Wallet, plan: 1_000_000, balance: 1_000_000, spent: 0 },
]

type DemoAction = 'quick' | 'income' | 'allocate' | 'spend' | 'loan' | null

export function DemoScreen() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'home' | 'envelopes' | 'money'>('home')
  const [envelopes, setEnvelopes] = useState(INITIAL_ENVELOPES)
  const [walletCents, setWalletCents] = useState(0)
  const [action, setAction] = useState<DemoAction>(null)
  const [activeEnvelope, setActiveEnvelope] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const totalCents = walletCents + envelopes.reduce((sum, item) => sum + item.balance, 0)
  const allocation = useMemo(() => envelopes.reduce((sum, item) => sum + item.balance, 0), [envelopes])

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2400)
  }

  const performAction = (amount: number) => {
    const selected = envelopes.find(item => item.id === activeEnvelope)
    if (action === 'income') {
      setWalletCents(value => value + amount)
      notify('Income added to your demo wallet.')
    } else if (action === 'allocate' && selected) {
      if (amount > walletCents) { notify(`Only KES ${(walletCents / 100).toLocaleString('en-KE')} is unallocated.`); return }
      setWalletCents(value => value - amount)
      setEnvelopes(items => items.map(item => item.id === selected.id ? { ...item, balance: item.balance + amount } : item))
      notify(`Added money to ${selected.name}.`)
    } else if (action === 'spend' && selected) {
      if (amount > selected.balance) { notify(`Only KES ${(selected.balance / 100).toLocaleString('en-KE')} left in ${selected.name}.`); return }
      setEnvelopes(items => items.map(item => item.id === selected.id ? { ...item, balance: item.balance - amount, spent: item.spent + amount } : item))
      notify(`Purchase recorded in ${selected.name}.`)
    } else if (action === 'loan') {
      notify('Loan tracking is ready to explore in your own plan.')
    }
    setAction(null)
    setActiveEnvelope(null)
  }

  const openAction = (next: Exclude<DemoAction, null>) => {
    setActiveEnvelope(null)
    setAction(next)
  }

  return (
    <main className="demo-app">
      <header className="demo-topbar">
        <button className="demo-back" onClick={() => navigate('/')} aria-label="Back to Pockiva landing"><ArrowLeftRight size={17} /> <span>Preview</span></button>
        <BrandWordmark className="demo-wordmark" />
        <button className="demo-cta" onClick={() => navigate('/welcome')}>Make my plan <ChevronRight size={16} /></button>
      </header>

      <div className="demo-main">
        <section className="demo-welcome">
          <div><span className="demo-eyebrow">A SAMPLE MONTHLY PLAN</span><h1>Your money, with a plan.</h1><p>Explore the sample below. Changes stay in this preview and will not be saved.</p></div>
          <button className="demo-create-account" onClick={() => navigate('/welcome')}>Create my plan <ChevronRight size={16} /></button>
        </section>

        <section className="demo-summary" aria-label="Sample plan summary">
          <article className="demo-total"><span>Bank balance</span><MoneyText cents={totalCents} size="xl" /><small>Unallocated wallet + envelopes</small></article>
          <article><span>Unallocated</span><MoneyText cents={walletCents} size="lg" /></article>
          <article><span>In envelopes</span><MoneyText cents={allocation} size="lg" /></article>
          <article><span>Protected savings</span><MoneyText cents={0} size="lg" /></article>
        </section>

        <div className="demo-content-layout">
          <aside className="demo-wallet-panel">
            <div className="demo-panel-title"><span className="demo-wallet-icon"><Wallet size={19} /></span><div><strong>Unallocated wallet</strong><small>Available to give a purpose</small></div></div>
            <MoneyText cents={walletCents} size="xl" />
            <button onClick={() => openAction('income')}><Plus size={16} /> Add income</button>
          </aside>

          <section className="demo-envelope-section">
            <div className="demo-section-heading"><div><span className="demo-eyebrow">YOUR PLAN</span><h2>{tab === 'home' ? 'Essentials and goals' : tab === 'money' ? 'Money overview' : 'Your envelopes'}</h2></div><span className="demo-count">{envelopes.length} envelopes</span></div>
            {tab === 'money' ? (
              <div className="demo-money-panels">
                <article><span>Savings</span><strong>KES 10,000</strong><small>Protected in this sample</small></article>
                <article><span>Loans</span><strong>No loans</strong><small>Nothing to repay in this sample</small></article>
                <article><span>Goals</span><strong>School fees</strong><small>KES 5,000 planned</small></article>
              </div>
            ) : (
              <div className="demo-envelope-grid">
                {envelopes.map(envelope => {
                  const Icon = envelope.icon
                  const pct = envelope.plan ? Math.min(100, envelope.balance / envelope.plan * 100) : 0
                  const low = envelope.balance > 0 && pct < 20
                  return (
                    <article className="demo-envelope-card" key={envelope.id} style={{ borderLeftColor: envelope.color }}>
                      <div className="demo-envelope-icon" style={{ color: envelope.color, background: `color-mix(in srgb, ${envelope.color} 14%, var(--color-surface))` }}><Icon size={20} strokeWidth={2} /></div>
                      <div className="demo-envelope-info"><strong>{envelope.name}</strong><small>of KES {(envelope.plan / 100).toLocaleString('en-KE')} plan</small><ProgressBar value={pct} color={envelope.color} low={low} /><Tag variant={low ? 'low' : 'funded'} label={low ? 'Running low' : 'Funded'} /></div>
                      <strong className="demo-envelope-amount">KES {(envelope.balance / 100).toLocaleString('en-KE')}</strong>
                      <div className="demo-envelope-actions"><button onClick={() => { setActiveEnvelope(envelope.id); setAction('allocate') }}>Add</button><button onClick={() => { setActiveEnvelope(envelope.id); setAction('spend') }}>Spend</button></div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      <nav className="demo-nav" aria-label="Demo navigation">
        <button className={tab === 'home' ? 'active' : ''} onClick={() => setTab('home')}><House size={20} /><span>Home</span></button>
        <button className={tab === 'envelopes' ? 'active' : ''} onClick={() => setTab('envelopes')}><Layers size={20} /><span>Envelopes</span></button>
        <button className="demo-nav-plus" onClick={() => setAction('quick')} aria-label="Quick actions"><Plus size={24} /></button>
        <button className={tab === 'money' ? 'active' : ''} onClick={() => setTab('money')}><Wallet size={20} /><span>Money</span></button>
        <button onClick={() => navigate('/welcome')}><CircleHelp size={20} /><span>More</span></button>
      </nav>

      {action && (
        <div className="demo-modal-scrim" role="presentation" onClick={() => { setAction(null); setActiveEnvelope(null) }}>
          <section className="demo-action-panel" role="dialog" aria-modal="true" aria-labelledby="demo-action-title" onClick={event => event.stopPropagation()}>
            <button className="demo-close" onClick={() => { setAction(null); setActiveEnvelope(null) }} aria-label="Close"><X size={20} /></button>
            <h2 id="demo-action-title">{action === 'quick' ? 'What would you like to do?' : action === 'income' ? 'Add income' : action === 'allocate' ? (activeEnvelope ? `Add to ${envelopes.find(item => item.id === activeEnvelope)?.name}` : 'Allocate') : action === 'spend' ? 'Log a purchase' : 'Record a loan'}</h2>
            <p>This sample is interactive. Changes stay in this browser preview.</p>
            {action === 'quick' ? (
              <div className="demo-quick-actions">
                <button onClick={() => setAction('income')}><ArrowDownToLine size={20} /> Add income</button>
                <button onClick={() => setAction('allocate')}><ArrowLeftRight size={20} /> Allocate</button>
                <button onClick={() => setAction('spend')}><ShoppingCart size={20} /> Log a purchase</button>
                <button onClick={() => setAction('loan')}><Banknote size={20} /> Record a loan</button>
              </div>
            ) : (action === 'allocate' || action === 'spend') && !activeEnvelope ? (
              <div className="demo-choose-envelope">
                <span>Choose an envelope</span>
                {envelopes.map(envelope => <button key={envelope.id} onClick={() => setActiveEnvelope(envelope.id)}>{envelope.name}<strong>KES {(envelope.balance / 100).toLocaleString('en-KE')}</strong></button>)}
              </div>
            ) : (
              <div className="demo-amount-choices">
                {[100, 500, 1000].map(amount => <button key={amount} onClick={() => performAction(amount * 100)}>KES {amount.toLocaleString('en-KE')}</button>)}
              </div>
            )}
            {action === 'income' && <button className="demo-add-income" onClick={() => performAction(5000 * 100)}><ArrowDownToLine size={17} /> Add KES 5,000 income</button>}
          </section>
        </div>
      )}
      {toast && <div className="demo-toast" role="status">{toast}</div>}
      <div className="demo-footer-note">Demo data is temporary. <button onClick={() => navigate('/welcome')}>Start your own plan</button></div>
    </main>
  )
}
