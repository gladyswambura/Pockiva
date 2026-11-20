import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useStore, type EnvelopeState } from '@/store'
import { useT } from '@/i18n/useT'
import { BottomSheet } from '@/components/BottomSheet'
import { AmountKeypad } from '@/components/AmountKeypad'
import { ConfirmDialog } from '@/components/Shared'
import { showToast } from '@/components/Toast'
import { apiFetch, newKey, getToken } from '@/lib/api'
import { safeDecrypt, safeEncrypt } from '@/lib/crypto'
import { formatMoney } from '@/lib/money'
import { Plus } from 'lucide-react'
import { colors, envelopeColors } from '@/lib/tokens'
import { EnvelopeIdentityPicker, envelopeGroupDefaults, getEnvelopeIcon } from '@/components/EnvelopeIdentityPicker'

const GROUP_LABELS: Record<string, string> = {
  essentials: 'Essentials & commitments', education: 'Education', debt: 'Debts',
  emergency: 'Emergency', goals: 'Goals', family: 'Family',
  giving: 'Giving', personal: 'Personal', system: 'Pockiva', other: 'Other',
}

const GROUP_ORDER = ['essentials', 'debt', 'goals', 'emergency', 'education', 'family', 'giving', 'personal', 'other']

const GROUP_COLORS: Record<string, string> = {
  essentials: envelopeColors[0], education: envelopeColors[2], debt: colors.danger,
  emergency: envelopeColors[7], goals: envelopeColors[5], family: envelopeColors[3],
  giving: envelopeColors[11], personal: envelopeColors[1], system: envelopeColors[11], other: envelopeColors[10],
}

type SheetMode = 'add' | 'spend' | 'release' | 'move' | 'edit' | 'create' | 'fundall' | 'clearall' | 'deleteall' | 'template' | null
type FilterKey = 'all' | 'essentials' | 'debt' | 'goals'
type ViewMode = 'cards' | 'table'

export function EnvelopesScreen() {
  const t = useT()
  const { summary, envelopes, setEnvelopes, setSummary, dek, _hasHydrated } = useStore()
  const [filter, setFilter] = useState<FilterKey>('all')
  const [view, setView] = useState<ViewMode>('cards')
  const [sheet, setSheet] = useState<SheetMode>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchParams, setSearchParams] = useSearchParams()

  // Quick action: ?action=new opens the create sheet, ?action=fundall opens fund-all
  useEffect(() => {
    const a = searchParams.get('action')
    if (a === 'new') { open('create'); setSearchParams({}, { replace: true }) }
    if (a === 'fundall') { open('fundall'); setSearchParams({}, { replace: true }) }
    if (a === 'template') { open('template'); setSearchParams({}, { replace: true }) }
  }, [searchParams, setSearchParams])

  const active = envelopes.find(e => e.id === activeId) ?? null
  const token = getToken()

  const refreshEnvelopes = async () => {
    if (!_hasHydrated || !token) return
    try {
      const raw = await apiFetch<{ id: string; name_enc: string; group_code: string; color: string; icon: string; sort_order: number; plan_cents: number; goal_cents: number; balance_cents: number; funded_cents: number; spent_cents: number; lock_until: string | null; kind: string; archived_at: string | null }[]>('/envelopes')
      const currentDek = useStore.getState().dek
      const decoded: EnvelopeState[] = await Promise.all(raw.map(async e => ({
        id: e.id,
        nameEnc: e.name_enc ?? '',
        namePlain: currentDek ? await safeDecrypt(e.name_enc ?? '', currentDek) : '',
        groupCode: e.group_code ?? 'other',
        color: e.color ?? GROUP_COLORS[e.group_code ?? 'other'] ?? 'var(--env-blue)',
        icon: e.icon ?? 'circle',
        sortOrder: e.sort_order,
        planCents: e.plan_cents,
        goalCents: e.goal_cents,
        balanceCents: e.balance_cents,
        fundedCents: e.funded_cents,
        spentCents: e.spent_cents,
        lockUntil: e.lock_until,
        kind: e.kind,
        archivedAt: e.archived_at,
      })))
      setEnvelopes(decoded)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refreshEnvelopes() }, [token, _hasHydrated, dek])

  const open = (mode: SheetMode, id?: string) => {
    setActiveId(id ?? null)
    setSheet(mode)
  }
  const close = () => { setSheet(null); setActiveId(null) }

  const handleDelete = async () => {
    if (!active) return
    try {
      await apiFetch(`/envelopes/${active.id}`, { method: 'DELETE', idempotencyKey: newKey() })
      await refreshEnvelopes()
      const s = await apiFetch<ReturnType<typeof useStore.getState>['summary']>('/summary')
      setSummary(s!)
      showToast(`${active.namePlain} deleted. Balance returned to wallet.`)
    } catch { showToast('Could not delete envelope.') }
    setConfirmDelete(false)
    close()
  }

  const filtered = filter === 'all'
    ? envelopes
    : envelopes.filter(e => (e.groupCode || 'other') === filter)

  // Group filtered envelopes
  const groupCodes = [...new Set(filtered.map(e => e.groupCode || 'other'))]
    .sort((a, b) => (GROUP_ORDER.indexOf(a) + 1 || 99) - (GROUP_ORDER.indexOf(b) + 1 || 99))

  const filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'essentials', label: 'Essentials' },
    { key: 'debt', label: 'Debts' },
    { key: 'goals', label: 'Goals' },
  ]

  const canFundAll = envelopes.some(e => e.planCents > 0) && (summary?.walletCents ?? 0) > 0

  return (
    <div className="screen-page" data-testid="envelopes-screen">
      <div className="screen-heading">
        <h1>{t.envelopes.title}</h1>
        <div className="header-actions">
          {/* Management actions — only when envelopes exist */}
          {envelopes.length > 0 && (
            <>
              <button className="btn btn--ghost env-fundall-btn" onClick={() => open('fundall')} disabled={!canFundAll}>Fund all</button>
              <button className="btn btn--ghost env-clear-btn" onClick={() => open('clearall')} style={{ color: 'var(--color-warning, #B45309)' }}>Clear all</button>
              <button className="btn btn--ghost env-delete-btn" onClick={() => open('deleteall')} style={{ color: 'var(--color-danger)' }}>Delete all</button>
            </>
          )}
          {/* Creation actions — always visible */}
          <button className="btn btn--ghost env-template-btn" onClick={() => open('template')} style={{ color: 'var(--color-accent, #C6923A)' }}>Use Template</button>
          <button className="btn btn--primary env-new-btn" onClick={() => open('create')}>
            <Plus size={18} /> New envelope
          </button>
          {/* Mobile: gold FAB — always visible */}
          <button className="env-fab" onClick={() => open('create')} aria-label="New envelope">
            <Plus size={22} />
          </button>
        </div>
      </div>

      {/* Filter pills + view toggle */}
      <div className="envelopes-toolbar">
        <div className="filter-pills" role="tablist" aria-label="Filter envelopes">
          {filters.map(f => (
            <button
              key={f.key}
              role="tab"
              aria-selected={filter === f.key}
              className={`filter-pill ${filter === f.key ? 'filter-pill--active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="view-toggle" role="tablist" aria-label="View mode">
          <button role="tab" aria-selected={view === 'cards'} className={`view-toggle__btn ${view === 'cards' ? 'view-toggle__btn--active' : ''}`} onClick={() => setView('cards')}>Cards</button>
          <button role="tab" aria-selected={view === 'table'} className={`view-toggle__btn ${view === 'table' ? 'view-toggle__btn--active' : ''}`} onClick={() => setView('table')}>Table</button>
        </div>
      </div>

      {loading ? (
        <div className="loading-block">Loading envelopes…</div>
      ) : filtered.length === 0 ? (
        <div className="env-empty-card">
          <div className="home-empty-icon" aria-hidden="true">✉</div>
          <p className="home-empty-sub">No envelopes created.</p>
        </div>
      ) : view === 'table' ? (
        <EnvelopeTable envelopes={filtered} onOpen={id => open('edit', id)} />
      ) : (
        groupCodes.map(g => (
          <section key={g} className="envelope-group">
            <div className="section-heading">
              <h2>{GROUP_LABELS[g] ?? g}</h2>
              <span className="link-info" style={{ cursor: 'default' }}>
                {(filtered.filter(e => (e.groupCode || 'other') === g)).length} envelope{(filtered.filter(e => (e.groupCode || 'other') === g)).length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="envelope-grid">
              {filtered.filter(e => (e.groupCode || 'other') === g).map(e => (
                <EnvelopeCard
                  key={e.id}
                  envelope={e}
                  onOpen={() => open('edit', e.id)}
                  onSpend={() => open('spend', e.id)}
                  onAdd={() => open('add', e.id)}
                  onMove={() => open('move', e.id)}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {/* Action sheets */}
      <AllocateSheet open={sheet === 'add'} envelope={active} onClose={close} onDone={refreshEnvelopes} />
      <SpendSheet open={sheet === 'spend'} envelope={active} onClose={close} onDone={refreshEnvelopes} />
      <ReleaseSheet open={sheet === 'release'} envelope={active} onClose={close} onDone={refreshEnvelopes} />
      <MoveMoneySheet open={sheet === 'move'} envelope={active} envelopes={envelopes} onClose={close} onDone={refreshEnvelopes} />
      <EditSheet open={sheet === 'edit'} envelope={active} onClose={close} onDone={refreshEnvelopes} onDelete={() => setConfirmDelete(true)} />
      <CreateSheet open={sheet === 'create'} onClose={close} onDone={refreshEnvelopes} />
      <FundAllSheet open={sheet === 'fundall'} envelopes={envelopes} onClose={close} onDone={refreshEnvelopes} />
      <BulkActionSheet open={sheet === 'clearall'} mode="clear" envelopes={envelopes} onClose={close} onDone={refreshEnvelopes} />
      <BulkActionSheet open={sheet === 'deleteall'} mode="delete" envelopes={envelopes} onClose={close} onDone={refreshEnvelopes} />
      <UseTemplateSheet open={sheet === 'template'} onClose={close} onDone={refreshEnvelopes} hasEnvelopes={envelopes.length > 0} />

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${active?.namePlain ?? 'envelope'}?`}
        message={`Its balance will be returned to your wallet. This cannot be undone.`}
        confirmLabel="Delete" danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}

// ── Envelope card (wide) ─────────────────────────────────────

function getTag(e: EnvelopeState): { variant: string; label: string; meta: string | null } {
  if (e.kind === 'debt' || e.groupCode === 'debt') {
    const pct = e.planCents > 0 ? Math.round(((e.planCents - e.balanceCents) / e.planCents) * 100) : 0
    return { variant: 'debt', label: `Debt · ${pct}% repaid`, meta: `Still owed ${formatMoney(e.balanceCents)}` }
  }
  if (e.lockUntil && new Date(`${e.lockUntil}T23:59:59`) > new Date()) return { variant: 'locked', label: 'Locked', meta: null }
  if (e.planCents > 0 && e.spentCents >= e.planCents) return { variant: 'paid', label: 'Paid ✓', meta: null }
  if (e.goalCents > 0 || e.kind === 'goal' || e.groupCode === 'goals') {
    const savedPct = e.goalCents > 0 ? Math.min(100, Math.round(e.balanceCents / e.goalCents * 100)) : 0
    return { variant: 'goal', label: `Goal · ${savedPct}%`, meta: `Goal ${formatMoney(e.goalCents)}` }
  }
  if (e.fundedCents > 0 && (e.balanceCents / e.fundedCents) < 0.2) return { variant: 'low', label: 'Running low', meta: null }
  if (e.planCents > 0 && e.fundedCents >= e.planCents) return { variant: 'funded', label: 'Funded', meta: null }
  if (e.planCents > 0) return { variant: 'needs', label: 'Needs money', meta: null }
  return { variant: 'empty', label: 'Empty', meta: null }
}

function EnvelopeCard({ envelope: e, onOpen, onSpend, onAdd, onMove }: {
  envelope: EnvelopeState
  onOpen: () => void
  onSpend: () => void
  onAdd: () => void
  onMove: () => void
}) {
  const pct = e.planCents > 0 ? Math.min(100, (e.fundedCents / e.planCents) * 100) : 0
  const tag = getTag(e)
  const Icon = getEnvelopeIcon(e.icon.toLowerCase())

  return (
    <div className="env-card" role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onOpen() } }}>
      <div className="env-card__strip" style={{ background: e.color }} />
      <div className="env-card__content">
        <div className="env-card__body">
          <span className="icon-tile icon-tile--sm" style={{ background: `color-mix(in srgb, ${e.color} 14%, var(--color-surface))`, color: e.color }}>
            <Icon size={18} />
          </span>
          <span className="env-card__main">
            <span className="env-card__name">{e.namePlain || '\u00b7\u00b7\u00b7'}</span>
            {e.planCents > 0 && (
              <div className="progress">
                <div className="progress__fill" style={{ width: `${pct}%`, background: e.color }} />
              </div>
            )}
            <span className="env-card__tagline">
              {tag.meta && <span className="env-card__meta">{tag.meta}</span>}
              <span className={`tag tag--${tag.variant}`}>{tag.label}</span>
            </span>
          </span>
          <span className="env-card__amount">{formatMoney(e.balanceCents)}</span>
        </div>
        <div className="env-card__actions" onClick={ev => ev.stopPropagation()}>
          <button className="btn btn--ghost" onClick={onSpend}>Spend</button>
          <button className="btn btn--ghost" onClick={onAdd}>Add</button>
          <button className="btn btn--ghost" onClick={onMove}>Move</button>
        </div>
      </div>
    </div>
  )
}

// ── Table view (wide) ────────────────────────────────────────

function EnvelopeTable({ envelopes, onOpen }: { envelopes: EnvelopeState[]; onOpen: (id: string) => void }) {
  return (
    <div className="envelope-table-wrap">
      <table className="envelope-table">
        <thead>
          <tr>
            <th>Envelope</th>
            <th className="ta-right">Plan</th>
            <th className="ta-right">Funded</th>
            <th className="ta-right">Spent</th>
            <th className="ta-right">Remaining</th>
            <th className="ta-right">Owed</th>
          </tr>
        </thead>
        <tbody>
          {envelopes.map(e => (
            <tr key={e.id} onClick={() => onOpen(e.id)} className="envelope-table__row">
              <td>
                <span className="envelope-table__name">
                  <span className="envelope-table__dot" style={{ background: e.color }} />
                  {e.namePlain || '···'}
                </span>
              </td>
              <td className="ta-right num">{formatMoney(e.planCents)}</td>
              <td className="ta-right num">{formatMoney(e.fundedCents)}</td>
              <td className="ta-right num">{formatMoney(e.spentCents)}</td>
              <td className="ta-right num">{formatMoney(e.balanceCents)}</td>
              <td className="ta-right num" style={{ color: e.kind === 'debt' ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                {e.kind === 'debt' ? formatMoney(e.balanceCents) : 'N/A'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Fund all sheet ───────────────────────────────────────────

function FundAllSheet({ open, envelopes, onClose, onDone }: { open: boolean; envelopes: EnvelopeState[]; onClose: () => void; onDone: () => void }) {
  const { summary, setSummary } = useStore()
  const funded = envelopes.filter(e => e.planCents > 0)
  const totalNeeded = funded.reduce((s, e) => s + Math.max(0, e.planCents - e.fundedCents), 0)
  const available = summary?.walletCents ?? 0

  const handleConfirm = async () => {
    try {
      await apiFetch('/ledger/fund-all', { method: 'POST', body: {}, idempotencyKey: newKey(), offlineFallback: true })
      await onDone()
      const s = await apiFetch<ReturnType<typeof useStore.getState>['summary']>('/summary')
      setSummary(s!)
      showToast('Envelopes funded to plan.')
      onClose()
    } catch { showToast('Could not fund envelopes.') }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Fund all envelopes">
      <p className="sheet-sub">Available in wallet: <strong>{formatMoney(available)}</strong></p>
      <div className="fundall-list">
        {funded.map(e => {
          const need = Math.max(0, e.planCents - e.fundedCents)
          return (
            <div key={e.id} className="fundall-row">
              <span className="fundall-row__name">{e.namePlain}</span>
              <span className="fundall-row__need">{need > 0 ? formatMoney(need) : 'Funded ✓'}</span>
            </div>
          )
        })}
      </div>
      {totalNeeded > available && (
        <p className="sheet-warn">You need {formatMoney(totalNeeded - available)} more. Add income first.</p>
      )}
      <button className="btn btn--primary btn--block" onClick={handleConfirm} style={{ marginTop: 16 }}>
        Confirm · {formatMoney(Math.min(totalNeeded, available))}
      </button>
    </BottomSheet>
  )
}

// ── Allocate sheet ────────────────────────────────────────────

function AllocateSheet({ open, envelope, onClose, onDone }: { open: boolean; envelope: EnvelopeState | null; onClose: () => void; onDone: () => void }) {
  const { summary, setSummary } = useStore()
  if (!envelope) return null
  const handleConfirm = async (cents: number) => {
    try {
      await apiFetch('/ledger/allocate', { method: 'POST', body: { envelope_id: envelope.id, amount_cents: cents }, idempotencyKey: newKey(), offlineFallback: true })
      await onDone()
      const s = await apiFetch<typeof summary>('/summary'); setSummary(s!)
      showToast(`Added to ${envelope.namePlain}.`)
      onClose()
    } catch (e: unknown) {
      const err = e as { error?: { message?: string } }
      showToast(err?.error?.message ?? 'Could not allocate.')
    }
  }
  return (
    <BottomSheet open={open} onClose={onClose} title={`Add to ${envelope.namePlain}`}>
      <p className="sheet-sub">Wallet: <strong>{formatMoney(summary?.walletCents ?? 0)}</strong> available</p>
      <AmountKeypad onConfirm={handleConfirm} maxCents={summary?.walletCents} />
    </BottomSheet>
  )
}

// ── Spend sheet ───────────────────────────────────────────────

function SpendSheet({ open, envelope, onClose, onDone }: { open: boolean; envelope: EnvelopeState | null; onClose: () => void; onDone: () => void }) {
  const { setSummary, summary } = useStore()
  const [note, setNote] = useState('')
  if (!envelope) return null
  const handleConfirm = async (cents: number) => {
    try {
      await apiFetch('/ledger/spend', { method: 'POST', body: { account_id: envelope.id, amount_cents: cents, note }, idempotencyKey: newKey(), offlineFallback: true })
      await onDone()
      const s = await apiFetch<typeof summary>('/summary'); setSummary(s!)
      showToast(`Spent ${formatMoney(cents)} from ${envelope.namePlain}. ${formatMoney(Math.max(0, envelope.balanceCents - cents))} left.`)
      onClose()
    } catch (e: unknown) {
      const err = e as { error?: { message?: string } }
      showToast(err?.error?.message ?? 'Could not log spend.')
    }
  }
  return (
    <BottomSheet open={open} onClose={onClose} title={envelope.kind === 'debt' ? `Pay towards ${envelope.namePlain}` : `Spend from ${envelope.namePlain}`}>
      <p className="sheet-sub">Balance {formatMoney(envelope.balanceCents)}</p>
      <div className="field" style={{ marginBottom: 12 }}>
        <label className="field__label">What was it for? (note)</label>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Naivas, matatu fare" className="field__input" style={{ marginTop: 6 }} />
      </div>
      <AmountKeypad onConfirm={handleConfirm} maxCents={envelope.balanceCents} />
    </BottomSheet>
  )
}

// ── Release sheet ─────────────────────────────────────────────

function ReleaseSheet({ open, envelope, onClose, onDone }: { open: boolean; envelope: EnvelopeState | null; onClose: () => void; onDone: () => void }) {
  const { setSummary, summary } = useStore()
  if (!envelope) return null
  const handleConfirm = async (cents: number) => {
    try {
      await apiFetch('/ledger/release', { method: 'POST', body: { envelope_id: envelope.id, amount_cents: cents }, idempotencyKey: newKey(), offlineFallback: true })
      await onDone()
      const s = await apiFetch<typeof summary>('/summary'); setSummary(s!)
      showToast('Released to wallet.')
      onClose()
    } catch { showToast('Could not release.') }
  }
  return (
    <BottomSheet open={open} onClose={onClose} title={`Move from ${envelope.namePlain}`}>
      <AmountKeypad onConfirm={handleConfirm} maxCents={envelope.balanceCents} />
    </BottomSheet>
  )
}

// ── Edit sheet ────────────────────────────────────────────────

function EditSheet({ open, envelope, onClose, onDone, onDelete }: { open: boolean; envelope: EnvelopeState | null; onClose: () => void; onDone: () => void; onDelete: () => void }) {
  const { dek } = useStore()
  const [name, setName] = useState('')
  const [plan, setPlan] = useState('')
  const [group, setGroup] = useState('essentials')
  const [color, setColor] = useState('')
  const [icon, setIcon] = useState('home')

  useEffect(() => {
    if (envelope) {
      setName(envelope.namePlain)
      setPlan(String(envelope.planCents / 100))
      setGroup(envelope.groupCode || 'essentials')
      setColor(envelope.color)
      setIcon(envelope.icon)
    }
  }, [envelope])

  if (!envelope) return null

  const handleSave = async () => {
    if (!dek) { showToast('Encryption key not loaded. Lock and unlock the app first.'); return }
    const nameEnc = await safeEncrypt(name, dek)
    await apiFetch(`/envelopes/${envelope.id}`, {
      method: 'PATCH',
      body: { name_enc: nameEnc, group_code: group, plan_cents: Math.round(parseFloat(plan || '0') * 100), color: group === 'debt' ? colors.danger : color, icon },
    })
    await onDone()
    showToast('Envelope updated.')
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Edit envelope">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Name">
          <input value={name} onChange={e => setName(e.target.value)} className="field__input" placeholder="Enter envelope name" autoFocus />
        </Field>
        <Field label="Monthly plan (KES)">
          <input value={plan} onChange={e => setPlan(e.target.value)} type="number" className="field__input" />
        </Field>
        <Field label="Group">
          <select value={group} onChange={e => { const next = e.target.value; const defaults = envelopeGroupDefaults(next); setGroup(next); setColor(defaults.color); setIcon(defaults.icon) }} className="field__input">
            {Object.entries(GROUP_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </Field>
        <EnvelopeIdentityPicker color={color} icon={icon} onColorChange={setColor} onIconChange={setIcon} debtLocked={group === 'debt'} />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={handleSave} className="btn btn--primary" style={{ flex: 1 }}>Save</button>
          <button onClick={onDelete} className="btn btn--danger">Delete</button>
        </div>
      </div>
    </BottomSheet>
  )
}

// ── Create sheet ──────────────────────────────────────────────

function CreateSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { dek } = useStore()
  const [name, setName] = useState('')
  const [plan, setPlan] = useState('')
  const [group, setGroup] = useState('essentials')
  const [color, setColor] = useState(envelopeGroupDefaults('essentials').color)
  const [icon, setIcon] = useState(envelopeGroupDefaults('essentials').icon)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!name.trim()) { setError('Give the envelope a name.'); return }
    if (!dek) { setError('Your encryption key is not loaded. Lock and unlock the app first.'); return }
    const nameEnc = await safeEncrypt(name, dek)
    try {
      await apiFetch('/envelopes', {
        method: 'POST',
        body: { name_enc: nameEnc, group_code: group, plan_cents: Math.round(parseFloat(plan || '0') * 100), color: group === 'debt' ? colors.danger : color, icon },
      })
      await onDone()
      showToast(`${name} created.`)
      setName(''); setPlan(''); setError('')
      onClose()
    } catch (e: unknown) {
      const err = e as { detail?: { message?: string } }
      setError(err?.detail?.message ?? 'Could not create envelope.')
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="New envelope">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Name">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Rent, Food, Tithe" autoFocus className="field__input" />
        </Field>
        <Field label="Group">
          <select value={group} onChange={e => { const next = e.target.value; const defaults = envelopeGroupDefaults(next); setGroup(next); setColor(defaults.color); setIcon(defaults.icon) }} className="field__input">
            {Object.entries(GROUP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Monthly plan (KES, optional)">
          <input value={plan} onChange={e => setPlan(e.target.value)} type="number" placeholder="0" className="field__input" />
        </Field>
        <EnvelopeIdentityPicker color={color} icon={icon} onColorChange={setColor} onIconChange={setIcon} debtLocked={group === 'debt'} />
        {error && <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p>}
        <button onClick={handleCreate} className="btn btn--primary btn--block">Create envelope</button>
      </div>
    </BottomSheet>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label className="field__label">{label}</label>
      {children}
    </div>
  )
}

// ── Bulk action sheet (clear all / delete all) ────────────────────────────

function BulkActionSheet({ open, mode, envelopes, onClose, onDone }: {
  open: boolean
  mode: 'clear' | 'delete'
  envelopes: EnvelopeState[]
  onClose: () => void
  onDone: () => void
}) {
  const { setSummary, summary } = useStore()
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (open) setConfirmed(false) }, [open])

  const isClear = mode === 'clear'
  const totalBalance = envelopes.reduce((s, e) => s + e.balanceCents, 0)

  const handleConfirm = async () => {
    setBusy(true)
    try {
      if (isClear) {
        await apiFetch('/auth/envelopes/clear-all', { method: 'POST', body: {}, idempotencyKey: newKey() })
        showToast('All envelope balances cleared. Funds returned to wallet.')
      } else {
        await apiFetch('/auth/envelopes/delete-all', { method: 'DELETE', idempotencyKey: newKey() })
        showToast('All envelopes deleted. Funds returned to wallet.')
      }
      await onDone()
      const s = await apiFetch<typeof summary>('/summary'); setSummary(s!)
      onClose()
    } catch { showToast(`Could not ${isClear ? 'clear' : 'delete'} envelopes.`) }
    finally { setBusy(false) }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={isClear ? 'Clear all envelopes' : 'Delete all envelopes'}>
      {!confirmed ? (
        <>
          <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
            {isClear
              ? `This will zero out all ${envelopes.length} envelope balances and return ${formatMoney(totalBalance)} to your wallet. The envelopes themselves stay.`
              : `This will permanently delete all ${envelopes.length} envelopes and return ${formatMoney(totalBalance)} to your wallet. This cannot be undone.`
            }
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn--ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
            <button
              className="btn"
              style={{ flex: 1, background: isClear ? 'var(--color-warning, #B45309)' : 'var(--color-danger)', color: '#fff', border: 'none', borderRadius: 'var(--radius-card)', fontWeight: 700, cursor: 'pointer', height: 48 }}
              onClick={() => setConfirmed(true)}
            >
              Yes, {isClear ? 'clear' : 'delete'} all
            </button>
          </div>
        </>
      ) : (
        <>
          <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16, fontWeight: 600, color: 'var(--color-danger)' }}>
            Are you absolutely sure? {isClear ? 'All balances will be zeroed.' : 'All envelopes will be gone forever.'}
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn--ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
            <button
              className="btn"
              style={{ flex: 1, background: 'var(--color-danger)', color: '#fff', border: 'none', borderRadius: 'var(--radius-card)', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', height: 48, opacity: busy ? 0.6 : 1 }}
              onClick={handleConfirm}
              disabled={busy}
            >
              {busy ? 'Working…' : `Confirm ${isClear ? 'clear' : 'delete'}`}
            </button>
          </div>
        </>
      )}
    </BottomSheet>
  )
}

// ── Move money sheet (S11) ────────────────────────────────────

function MoveMoneySheet({ open, envelope, envelopes, onClose, onDone }: {
  open: boolean
  envelope: EnvelopeState | null
  envelopes: EnvelopeState[]
  onClose: () => void
  onDone: () => void
}) {
  const { summary, setSummary } = useStore()
  const [toId, setToId] = useState<string>('')
  const [note, setNote] = useState('')

  const destinations = envelopes.filter(e => e.id !== envelope?.id)

  useEffect(() => {
    if (open && destinations.length > 0) setToId(destinations[0].id)
  }, [open, envelope?.id])

  if (!envelope) return null

  const handleConfirm = async (cents: number) => {
    if (!toId) return
    try {
      await apiFetch('/ledger/transfer', {
        method: 'POST',
        body: { from_account_id: envelope.id, to_account_id: toId, amount_cents: cents, note },
        idempotencyKey: newKey(),
        offlineFallback: true,
      })
      await onDone()
      const s = await apiFetch<typeof summary>('/summary'); setSummary(s!)
      const dest = envelopes.find(e => e.id === toId)
      showToast(`Moved ${formatMoney(cents)} to ${dest?.namePlain ?? 'envelope'}.`)
      onClose()
    } catch (e: unknown) {
      const err = e as { error?: { message?: string } }
      showToast(err?.error?.message ?? 'Could not move money.')
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={`Move money from ${envelope.namePlain}`}>
      <div style={{ marginBottom: 12 }}>
        <label className="field__label">To envelope</label>
        <select
          value={toId}
          onChange={e => setToId(e.target.value)}
          className="field__input"
          style={{ marginTop: 6 }}
        >
          {destinations.map(e => (
            <option key={e.id} value={e.id}>
              {e.namePlain || '···'} — {formatMoney(e.balanceCents)}
            </option>
          ))}
        </select>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label className="field__label">Note (optional)</label>
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="e.g. Covering shortfall"
          className="field__input"
          style={{ marginTop: 6 }}
        />
      </div>
      <AmountKeypad
        onConfirm={handleConfirm}
        maxCents={envelope.balanceCents}
        label={`Available: ${formatMoney(envelope.balanceCents)}`}
        confirmLabel="Move"
      />
    </BottomSheet>
  )
}

// ── Use Template sheet ────────────────────────────────────────

const STARTER_ENVELOPES: {
  name: string
  hint: string
  planCents: number
  group: string
  color: string
  icon: string
}[] = [
  { name: 'Rent',               hint: 'House rent, plot or service charge',                    planCents: 1400000, group: 'essentials', color: envelopeColors[0],  icon: 'home' },
  { name: 'Food',               hint: 'Unga, vegetables, milk, market, eating out',             planCents:  900000, group: 'essentials', color: envelopeColors[3],  icon: 'groceries' },
  { name: 'Transport',          hint: 'Matatu, boda, fuel, parking',                            planCents:  450000, group: 'essentials', color: envelopeColors[7],  icon: 'bus' },
  { name: 'Utilities & data',   hint: 'KPLC tokens, water, gas, Wi-Fi, airtime',                planCents:  500000, group: 'essentials', color: envelopeColors[8],  icon: 'wi-fi' },
  { name: 'Family support',     hint: 'Money to parents or relatives, school upkeep',           planCents:  400000, group: 'family',     color: envelopeColors[4],  icon: 'family' },
  { name: 'Giving',             hint: 'Church, mosque, harambee, gifts',                        planCents:  300000, group: 'giving',     color: envelopeColors[11], icon: 'giving' },
  { name: 'Health',             hint: 'SHA contribution, medicine, clinic visits',              planCents:  200000, group: 'essentials', color: envelopeColors[9],  icon: 'health' },
  { name: 'Personal',           hint: 'Clothes, hair, toiletries, your own spending',           planCents:  250000, group: 'personal',   color: envelopeColors[1],  icon: 'clothing' },
  { name: 'Emergency savings',  hint: "Money you don't touch — goes to protected savings",      planCents:  500000, group: 'emergency',  color: envelopeColors[6],  icon: 'emergency' },
  { name: 'Everyday buffer',    hint: 'Small surprises, M-Pesa and bank charges',               planCents:  100000, group: 'other',      color: envelopeColors[10], icon: 'wallet' },
]

const SUGGESTION_CHIPS = [
  'School fees', 'Loan repayment', 'Rent deposit', 'Insurance',
  'Business stock', 'Childcare', 'Holiday & Christmas', 'Car or boda',
]

function UseTemplateSheet({ open, onClose, onDone, hasEnvelopes }: {
  open: boolean
  onClose: () => void
  onDone: () => void
  hasEnvelopes: boolean
}) {
  const { dek, setIsNewUser } = useStore()
  const [step, setStep] = useState<'pick' | 'confirm'>('pick')
  const [busy, setBusy] = useState(false)
  const [replaceExisting, setReplaceExisting] = useState(false)

  useEffect(() => { if (open) { setStep('pick'); setReplaceExisting(false) } }, [open])

  const handleApply = async () => {
    if (!dek) { showToast('Your encryption key is not loaded. Lock and unlock the app first.'); return }
    setBusy(true)
    try {
      const envelopes = await Promise.all(
        STARTER_ENVELOPES.map(async (e, i) => ({
          name_enc: await safeEncrypt(e.name, dek),
          group_code: e.group,
          color: e.color,
          icon: e.icon,
          plan_cents: e.planCents,
          sort_order: i,
        }))
      )
      await apiFetch('/envelopes/apply-template', {
        method: 'POST',
        body: { envelopes, replace_existing: replaceExisting },
      })
      await onDone()
      setIsNewUser(true)
      showToast('Starter plan ready. Add your income and we will fill it.')
      onClose()
    } catch { showToast('Could not apply template.') }
    finally { setBusy(false) }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Use Template">
      {!dek ? (
        <p style={{ fontSize: 14, color: 'var(--color-danger)', lineHeight: 1.6 }}>
          Your encryption key is not loaded. Lock the app and enter your PIN to unlock it, then try again.
        </p>
      ) : step === 'pick' ? (
        <>
          {/* Starter card */}
          <div style={{
            border: '2px solid #C6923A', borderRadius: 12, padding: '14px 16px', marginBottom: 16,
            background: 'color-mix(in srgb, #C6923A 6%, var(--color-surface))',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <strong style={{ fontSize: 15 }}>Starter</strong>
              <span style={{ fontSize: 12, color: '#C6923A', fontWeight: 600 }}>Recommended</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '0 0 10px' }}>
              10 envelopes · planned KES 50,000
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {STARTER_ENVELOPES.map(e => (
                <div key={e.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13 }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{e.name}</span>
                    <span style={{ color: 'var(--color-text-muted)', marginLeft: 6, fontSize: 12 }}>{e.hint}</span>
                  </div>
                  <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', marginLeft: 8 }}>
                    {formatMoney(e.planCents)}
                  </span>
                </div>
              ))}
            </div>
            {hasEnvelopes && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={replaceExisting} onChange={e => setReplaceExisting(e.target.checked)} />
                Replace my existing envelopes
              </label>
            )}
            <button className="btn btn--primary btn--block" onClick={() => setStep('confirm')}>
              Continue with KES 50,000 Template
            </button>
          </div>

          {/* Suggestion chips */}
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8 }}>
            Add what applies to you
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SUGGESTION_CHIPS.map(chip => (
              <span key={chip} style={{
                padding: '5px 12px', borderRadius: 20, border: '1px solid var(--color-border)',
                fontSize: 13, color: 'var(--color-text-muted)', background: 'var(--color-surface)',
              }}>
                {chip}
              </span>
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8 }}>
            These aren't in the Starter plan. Create them individually after setup.
          </p>
        </>
      ) : (
        <>
          <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
            This will create 10 envelopes with a total plan of KES 50,000.
            {replaceExisting && ' Your existing envelopes will be archived.'}
            {' '}No money is moved — every envelope starts at KES 0.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn--ghost" style={{ flex: 1 }} onClick={() => setStep('pick')}>Back</button>
            <button
              className="btn btn--primary"
              style={{ flex: 1 }}
              onClick={handleApply}
              disabled={busy}
            >
              {busy ? 'Creating…' : 'Apply Starter plan'}
            </button>
          </div>
        </>
      )}
    </BottomSheet>
  )
}
