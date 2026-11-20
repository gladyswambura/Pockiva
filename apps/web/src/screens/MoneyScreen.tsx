import { useState } from 'react'
import { SavingsPanel } from '@/components/panels/SavingsPanel'
import { LoansPanel } from '@/components/panels/LoansPanel'
import { GoalsPanel } from '@/components/panels/GoalsPanel'

type Tab = 'savings' | 'loans' | 'goals'

const TABS: { id: Tab; label: string }[] = [
  { id: 'savings', label: 'Savings' },
  { id: 'loans',   label: 'Loans' },
  { id: 'goals',   label: 'Goals' },
]

export function MoneyScreen() {
  const [tab, setTab] = useState<Tab>('savings')

  return (
    <div className="screen-page">
      <div className="screen-heading">
        <h1>Money</h1>
      </div>

      {/* Segmented control — 3 pills */}
      <div className="money-tabs" role="tablist">
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`money-tab${tab === t.id ? ' money-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'savings' && <SavingsPanel />}
      {tab === 'loans'   && <LoansPanel />}
      {tab === 'goals'   && <GoalsPanel />}
    </div>
  )
}
