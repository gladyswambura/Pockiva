import { useEffect, useState } from 'react'
import { useT } from '@/i18n/useT'
import { EmptyState } from '@/components/Shared'
import { useStore } from '@/store'
import { apiFetch, getToken } from '@/lib/api'
import { safeDecrypt } from '@/lib/crypto'
import { formatMoney } from '@/lib/money'
import { MoreHorizontal, ArrowDownLeft, ArrowUpRight, Repeat } from 'lucide-react'

interface LedgerEntry {
  id: string
  kind: string
  from_account_id: string | null
  to_account_id: string | null
  amount_cents: number
  note_enc: string | null
  created_at: string
}

interface LedgerItem extends LedgerEntry {
  notePlain: string
  title: string
  direction: 'in' | 'out' | 'transfer'
}

const KIND_LABELS: Record<string, string> = {
  deposit: 'Income',
  allocate: 'Allocated',
  release: 'Released',
  spend: 'Spend',
  save: 'Moved to savings',
  unsave: 'From savings',
  transfer: 'Transfer',
  loan_received: 'Loan received',
  loan_payment: 'Loan payment',
}

const KIND_ICONS: Record<string, 'in' | 'out' | 'transfer'> = {
  deposit: 'in', allocate: 'transfer', release: 'in', spend: 'out',
  save: 'transfer', unsave: 'transfer', transfer: 'transfer',
  loan_received: 'in', loan_payment: 'out',
}

type Filter = 'all' | 'in' | 'out' | 'transfer'

export function HistoryScreen() {
  const t = useT()
  const { dek, _hasHydrated } = useStore()
  const [filter, setFilter] = useState<Filter>('all')
  const [items, setItems] = useState<LedgerItem[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)

  const token = getToken()

  const load = async (reset = false) => {
    const params = new URLSearchParams({ limit: '50' })
    if (cursor && !reset) params.set('cursor', cursor)
    const data = await apiFetch<{ items: LedgerEntry[]; next_cursor: string | null }>(`/ledger?${params}`)
    const decoded: LedgerItem[] = await Promise.all(data.items.map(async e => ({
      ...e,
      notePlain: e.note_enc ? await safeDecrypt(e.note_enc, dek) : '',
      title: KIND_LABELS[e.kind] ?? e.kind,
      direction: KIND_ICONS[e.kind] ?? 'transfer',
    })))
    setItems(prev => reset ? decoded : [...prev, ...decoded])
    setCursor(data.next_cursor)
    setHasMore(!!data.next_cursor)
    setLoading(false)
  }

  useEffect(() => {
    if (!_hasHydrated || !token) return
    load(true).catch(() => setLoading(false))
  }, [token, _hasHydrated])

  const filtered = filter === 'all' ? items : items.filter(i => i.direction === filter)

  // Group by date label
  const groups: { label: string; items: LedgerItem[] }[] = []
  for (const item of filtered) {
    const d = new Date(item.created_at)
    const today = new Date()
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
    let label: string
    if (d.toDateString() === today.toDateString()) label = 'Today'
    else if (d.toDateString() === yesterday.toDateString()) label = 'Yesterday'
    else label = d.toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' })
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(item)
    else groups.push({ label, items: [item] })
  }

  return (
    <div className="screen-page history-screen">
      <header className="screen-heading">
        <div>
          <h1>{t.history.title}</h1>
        </div>
      </header>

      <div className="screen-content">
        <div className="filter-pills" role="tablist">
          {(['all', 'in', 'out', 'transfer'] as const).map(f => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              className={`filter-pill${filter === f ? ' filter-pill--active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f === 'in' ? 'Money in' : f === 'out' ? 'Spends' : 'Transfers'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading-block">Loading history…</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<MoreHorizontal size={40} />} message={t.history.empty} />
        ) : (
          <>
            {groups.map(g => (
              <div key={g.label} className="history-group">
                <div className="history-group__date">{g.label}</div>
                <div className="transaction-list">
                  {g.items.map(item => <TransactionRow key={item.id} item={item} />)}
                </div>
              </div>
            ))}
            {hasMore && (
              <button
                onClick={() => { setLoading(true); load(false).catch(() => setLoading(false)) }}
                className="load-more-btn"
              >
                Load more
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function TransactionRow({ item }: { item: LedgerItem }) {
  const colors = {
    in: { bg: 'var(--color-success)', sign: '+' },
    out: { bg: 'var(--color-danger)', sign: '−' },
    transfer: { bg: 'var(--color-info)', sign: '' },
  }
  const c = colors[item.direction]

  return (
    <article className="transaction-row">
      <div className="tx-icon" style={{ background: c.bg }}>
        {item.direction === 'in' ? <ArrowDownLeft size={16} /> : item.direction === 'out' ? <ArrowUpRight size={16} /> : <Repeat size={16} />}
      </div>
      <div className="tx-details">
        <div className="tx-description">{item.notePlain || item.title}</div>
        <div className="tx-meta">
          <span className="tx-category">{item.title}</span>
          <time>{new Date(item.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' })}</time>
        </div>
      </div>
      <div className={`tx-amount ${item.direction === 'in' ? 'positive' : item.direction === 'out' ? 'negative' : ''}`}>
        {c.sign}{formatMoney(item.amount_cents)}
      </div>
    </article>
  )
}