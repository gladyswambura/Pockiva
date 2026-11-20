import { useEffect, useState } from 'react'
import { useStore } from '@/store'
import { apiFetch, getToken } from '@/lib/api'
import { safeDecrypt } from '@/lib/crypto'
import { formatMoney } from '@/lib/money'
import { ArrowDownLeft, ArrowUpRight, Repeat, Download } from 'lucide-react'

interface LedgerEntry {
  id: string
  kind: string
  amount_cents: number
  note_enc: string | null
  created_at: string
}

interface LedgerItem extends LedgerEntry {
  notePlain: string
  direction: 'in' | 'out' | 'transfer'
}

const KIND_LABELS: Record<string, string> = {
  deposit: 'Income', allocate: 'Allocated to envelope', release: 'Released to wallet',
  spend: 'Spend', save: 'Moved to savings', unsave: 'From savings',
  transfer: 'Transfer', loan_received: 'Loan received', loan_payment: 'Loan payment',
}
const KIND_DIR: Record<string, 'in' | 'out' | 'transfer'> = {
  deposit: 'in', allocate: 'transfer', release: 'in', spend: 'out',
  save: 'transfer', unsave: 'transfer', transfer: 'transfer',
  loan_received: 'in', loan_payment: 'out',
}

function monthLabel(y: number, m: number) {
  return new Date(y, m - 1, 1).toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })
}

export function ReportScreen() {
  const { dek, _hasHydrated } = useStore()
  const token = getToken()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [items, setItems] = useState<LedgerItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!_hasHydrated || !token) return
    setLoading(true)
    apiFetch<{ items: LedgerEntry[]; next_cursor: string | null }>('/ledger?limit=500')
      .then(async data => {
        const decoded: LedgerItem[] = await Promise.all(data.items.map(async e => ({
          ...e,
          notePlain: e.note_enc ? await safeDecrypt(e.note_enc, dek) : '',
          direction: KIND_DIR[e.kind] ?? 'transfer',
        })))
        setItems(decoded)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token, _hasHydrated])

  const monthItems = items.filter(i => {
    const d = new Date(i.created_at)
    return d.getFullYear() === year && d.getMonth() + 1 === month
  })

  const totalIn    = monthItems.filter(i => i.direction === 'in').reduce((s, i) => s + i.amount_cents, 0)
  const totalOut   = monthItems.filter(i => i.direction === 'out').reduce((s, i) => s + i.amount_cents, 0)
  const totalMoved = monthItems.filter(i => i.direction === 'transfer').reduce((s, i) => s + i.amount_cents, 0)
  const net = totalIn - totalOut

  // Available months from data
  const availableMonths = [...new Set(items.map(i => {
    const d = new Date(i.created_at)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }))].sort().reverse()

  const handleExport = () => {
    const rows = [
      ['Date', 'Type', 'Note', 'Direction', 'Amount (KES)'],
      ...monthItems.map(i => [
        new Date(i.created_at).toLocaleDateString('en-KE'),
        KIND_LABELS[i.kind] ?? i.kind,
        i.notePlain,
        i.direction,
        (i.amount_cents / 100).toFixed(2),
      ]),
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `pockiva-report-${year}-${String(month).padStart(2, '0')}.csv`
    a.click()
  }

  return (
    <div className="screen-page">
      <div className="screen-heading">
        <h1>Monthly report</h1>
        <button className="btn btn--ghost" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* Month picker */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)' }}>Month</label>
        <select
          value={`${year}-${String(month).padStart(2, '0')}`}
          onChange={e => { const [y, m] = e.target.value.split('-'); setYear(+y); setMonth(+m) }}
          className="field__input"
          style={{ width: 'auto', minWidth: 180 }}
        >
          {availableMonths.length > 0
            ? availableMonths.map(ym => {
                const [y, m] = ym.split('-')
                return <option key={ym} value={ym}>{monthLabel(+y, +m)}</option>
              })
            : <option value={`${year}-${String(month).padStart(2, '0')}`}>{monthLabel(year, month)}</option>
          }
        </select>
      </div>

      {/* Summary cards */}
      <div className="report-summary">
        <div className="report-stat report-stat--in">
          <div className="report-stat__label">Money in</div>
          <div className="report-stat__value">{formatMoney(totalIn)}</div>
        </div>
        <div className="report-stat report-stat--out">
          <div className="report-stat__label">Spent</div>
          <div className="report-stat__value">{formatMoney(totalOut)}</div>
        </div>
        <div className="report-stat report-stat--move">
          <div className="report-stat__label">Moved / allocated</div>
          <div className="report-stat__value">{formatMoney(totalMoved)}</div>
        </div>
        <div className={`report-stat ${net >= 0 ? 'report-stat--net-pos' : 'report-stat--net-neg'}`}>
          <div className="report-stat__label">Net</div>
          <div className="report-stat__value">{net >= 0 ? '+' : '−'}{formatMoney(Math.abs(net))}</div>
        </div>
      </div>

      {/* Transaction list */}
      {loading ? (
        <div className="loading-block">Loading…</div>
      ) : monthItems.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '40px 0', fontSize: 14 }}>
          No transactions for {monthLabel(year, month)}.
        </div>
      ) : (
        <div className="transaction-list" style={{ marginTop: 8 }}>
          {monthItems.map(item => {
            const dir = item.direction
            const sign = dir === 'in' ? '+' : dir === 'out' ? '−' : ''
            const iconBg = dir === 'in' ? 'var(--color-success)' : dir === 'out' ? 'var(--color-danger)' : 'var(--color-info)'
            return (
              <article key={item.id} className="transaction-row">
                <div className="tx-icon" style={{ background: iconBg }}>
                  {dir === 'in' ? <ArrowDownLeft size={16} /> : dir === 'out' ? <ArrowUpRight size={16} /> : <Repeat size={16} />}
                </div>
                <div className="tx-details">
                  <div className="tx-description">{item.notePlain || KIND_LABELS[item.kind] || item.kind}</div>
                  <div className="tx-meta">
                    <span className="tx-category">{KIND_LABELS[item.kind] ?? item.kind}</span>
                    <time>{new Date(item.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}</time>
                  </div>
                </div>
                <div className={`tx-amount ${dir === 'in' ? 'positive' : dir === 'out' ? 'negative' : ''}`}>
                  {sign}{formatMoney(item.amount_cents)}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
