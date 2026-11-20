import { useCallback, useEffect, useState } from 'react'
import { clearTokens, setTokens } from '@/lib/api'

type Section = 'overview' | 'users' | 'billing' | 'plans' | 'partners' | 'support' | 'content' | 'flags' | 'health' | 'audit' | 'team'

interface Metrics {
  total_users: number
  active_paying: number
  trialing: number
  churned_30d: number
  mrr_cents: number
}

interface AuditItem {
  id: string
  actor_type: string
  actor_id: string
  action: string
  object_type: string
  object_id: string
  at: string
}

async function adminFetch<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const token = localStorage.getItem('access_token')
  const res = await fetch(`/admin/v1${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const b = await res.json().catch(() => null) as { detail?: string } | null
    throw new Error(typeof b?.detail === 'string' ? b.detail : `Request failed (HTTP ${res.status})`)
  }
  return res.json() as Promise<T>
}

function fmtKes(cents: number) {
  return `KES ${(cents / 100).toLocaleString('en-KE', { maximumFractionDigits: 0 })}`
}

const NAV: { id: Section; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview',          icon: '▦' },
  { id: 'users',    label: 'Users',              icon: '👤' },
  { id: 'billing',  label: 'Billing',            icon: '💳' },
  { id: 'plans',    label: 'Plans & pricing',    icon: '🏷' },
  { id: 'partners', label: 'Partners',           icon: '🤝' },
  { id: 'support',  label: 'Support',            icon: '🎧' },
  { id: 'content',  label: 'Content',            icon: '✏️' },
  { id: 'flags',    label: 'Feature flags',      icon: '🚩' },
  { id: 'health',   label: 'System health',      icon: '💚' },
  { id: 'audit',    label: 'Audit log',          icon: '📋' },
  { id: 'team',     label: 'Admin team',         icon: '🔑' },
]

const PAGE_TITLES: Record<Section, string> = {
  overview: 'Overview',
  users:    'Users',
  billing:  'Billing',
  plans:    'Plans & pricing',
  partners: 'Partners',
  support:  'Support',
  content:  'Content',
  flags:    'Feature flags',
  health:   'System health',
  audit:    'Audit log',
  team:     'Admin team',
}

// ── Stub panel ───────────────────────────────────────────────────────────────
function StubPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="adm-stub">
      <div className="adm-stub__icon">🚧</div>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  )
}

// ── Overview panel ───────────────────────────────────────────────────────────
function OverviewPanel({ metrics, audit, onRefresh }: {
  metrics: Metrics | null
  audit: AuditItem[]
  onRefresh: () => void
}) {
  const cards = [
    { label: 'Total users',       value: metrics?.total_users.toLocaleString() ?? '—' },
    { label: 'New this week',     value: '—' },
    { label: 'Active (7 days)',   value: '—' },
    { label: 'Plus subscribers',  value: metrics?.active_paying.toLocaleString() ?? '—' },
    { label: 'MRR',               value: metrics ? fmtKes(metrics.mrr_cents) : '—' },
    { label: 'Trial → paid %',    value: metrics ? `${metrics.trialing} trialing` : '—' },
  ]

  return (
    <div className="adm-overview">
      <div className="adm-metric-row">
        {cards.map(c => (
          <article key={c.label} className="adm-metric-card">
            <span className="adm-metric-card__label">{c.label}</span>
            <strong className="adm-metric-card__value">{c.value}</strong>
          </article>
        ))}
      </div>

      <div className="adm-charts-row">
        <div className="adm-chart-card">
          <div className="adm-section-head"><span>Signups · last 30 days</span></div>
          <div className="adm-chart-placeholder">Chart coming soon</div>
        </div>
        <div className="adm-chart-card">
          <div className="adm-section-head"><span>Plan mix</span></div>
          <div className="adm-chart-placeholder">Chart coming soon</div>
        </div>
      </div>

      <div className="adm-panel">
        <div className="adm-section-head">
          <span>Needs attention</span>
          <button className="adm-text-btn" onClick={onRefresh}>Refresh</button>
        </div>
        <p className="adm-muted">No items need attention right now.</p>
      </div>

      <div className="adm-panel">
        <div className="adm-section-head"><span>Recent admin activity</span></div>
        {audit.length === 0
          ? <p className="adm-muted">No admin actions recorded yet.</p>
          : (
            <table className="adm-table">
              <thead>
                <tr><th>Time</th><th>Action</th><th>Target</th></tr>
              </thead>
              <tbody>
                {audit.slice(0, 8).map(r => (
                  <tr key={r.id}>
                    <td>{new Date(r.at).toLocaleString()}</td>
                    <td style={{ textTransform: 'capitalize' }}>{r.action.replace(/_/g, ' ')}</td>
                    <td className="adm-muted">{r.object_type} · {r.object_id.slice(0, 8)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  )
}

interface UserRow {
  id: string
  display_name: string | null
  email: string | null
  phone_e164: string | null
  plan_tier: string
  status: string
  created_at: string
  suspended_at: string | null
  envelope_count: number
  device_count: number
  entry_count: number
}

function maskEmail(email: string | null) {
  if (!email) return '—'
  const [local, domain] = email.split('@')
  if (!domain) return email
  return `${local.charAt(0)}***${local.charAt(local.length - 1)}@${domain}`
}

// ── Users panel ──────────────────────────────────────────────────────────────
function UsersPanel() {
  const [users, setUsers]       = useState<UserRow[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [err, setErr]           = useState('')
  const [search, setSearch]     = useState('')
  const [actionBusy, setActionBusy] = useState<string | null>(null)
  const [reasonModal, setReasonModal] = useState<{ userId: string; action: 'suspend' | 'reactivate' } | null>(null)
  const [reason, setReason]     = useState('')
  const [selected, setSelected] = useState<UserRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const data = await adminFetch<{ items: UserRow[]; total: number }>('/users?limit=100')
      setUsers(data.items)
      setTotal(data.total)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not load users.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const doAction = async () => {
    if (!reasonModal || !reason.trim()) return
    setActionBusy(reasonModal.userId)
    try {
      await adminFetch(`/users/${reasonModal.userId}/${reasonModal.action}`, 'POST', { reason: reason.trim() })
      setReasonModal(null); setReason('')
      await load()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Action failed.') }
    finally { setActionBusy(null) }
  }

  const filtered = users.filter(u => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      u.id.toLowerCase().includes(q) ||
      (u.display_name ?? '').toLowerCase().includes(q) ||
      (u.email ?? '').toLowerCase().includes(q) ||
      (u.phone_e164 ?? '').includes(q)
    )
  })

  const statusChip = (s: string) => {
    const map: Record<string, string> = {
      active: '#E6F4EA|#1E7E34',
      trial:  '#FEF3C7|#B45309',
      suspended: '#FEE2E2|#C23232',
    }
    const [bg, color] = (map[s] ?? '#F0F2F7|#596781').split('|')
    return <span style={{ background: bg, color, padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>{s}</span>
  }

  if (selected) {
    return (
      <div className="adm-panel-page">
        <div className="adm-panel">
          <div className="adm-section-head">
            <span>User profile</span>
            <button className="adm-text-btn" onClick={() => setSelected(null)}>← Back to list</button>
          </div>
          <div className="adm-user-card">
            {([
              ['Name',       selected.display_name || '—'],
              ['Email',      selected.email || '—'],
              ['Phone',      selected.phone_e164 || '—'],
              ['User ID',    selected.id],
              ['Plan',       selected.plan_tier],
              ['Status',     selected.status],
              ['Signed up',  new Date(selected.created_at).toLocaleDateString()],
              ['Envelopes',  String(selected.envelope_count) + ' (count only — names are encrypted)'],
              ['Devices',    String(selected.device_count)],
              ['Entries',    String(selected.entry_count)],
            ] as [string, string][]).map(([label, val]) => (
              <div key={label} className="adm-user-card__row">
                <span className="adm-user-card__label">{label}</span>
                <span style={{ fontSize: 13 }}>{val}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            {selected.status !== 'suspended'
              ? <button className="adm-btn-danger" disabled={!!actionBusy}
                  onClick={() => { setReasonModal({ userId: selected.id, action: 'suspend' }); setReason('') }}>
                  Suspend account
                </button>
              : <button className="adm-btn-success" disabled={!!actionBusy}
                  onClick={() => { setReasonModal({ userId: selected.id, action: 'reactivate' }); setReason('') }}>
                  Reactivate account
                </button>
            }
          </div>
        </div>
        {reasonModal && (
          <div className="adm-modal-overlay" onClick={() => setReasonModal(null)}>
            <div className="adm-modal" onClick={e => e.stopPropagation()}>
              <h3>{reasonModal.action === 'suspend' ? 'Suspend account' : 'Reactivate account'}</h3>
              <p className="adm-muted" style={{ marginBottom: 12 }}>Type a reason. This is logged and cannot be deleted.</p>
              <textarea className="adm-textarea" rows={3} value={reason} onChange={e => setReason(e.target.value)}
                placeholder="e.g. Reported for abuse, ticket #1234" />
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button className="adm-btn-primary" style={{ flex: 1 }} disabled={!reason.trim() || !!actionBusy} onClick={doAction}>
                  {actionBusy ? 'Please wait…' : 'Confirm'}
                </button>
                <button className="adm-btn-ghost" style={{ flex: 1 }} onClick={() => setReasonModal(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="adm-panel-page">
      {err && <p className="adm-error">{err}</p>}
      <div className="adm-panel">
        <div className="adm-section-head">
          <span>All users <span className="adm-muted" style={{ fontWeight: 400 }}>({total})</span></span>
          <button className="adm-text-btn" onClick={load}>Refresh</button>
        </div>
        <p className="adm-muted" style={{ marginBottom: 14, fontSize: 12 }}>
          Envelope names, notes and individual balances are never shown here.
        </p>
        <input className="adm-input" style={{ marginBottom: 14 }}
          placeholder="Filter by name, email, phone or ID…"
          value={search} onChange={e => setSearch(e.target.value)} />
        {loading
          ? <p className="adm-muted">Loading…</p>
          : (
            <div style={{ overflowX: 'auto' }}>
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th>Signed up</th>
                    <th>Envelopes</th>
                    <th>Devices</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0
                    ? <tr><td colSpan={8} className="adm-muted" style={{ textAlign: 'center', padding: 24 }}>No users found</td></tr>
                    : filtered.map(u => (
                      <tr key={u.id}>
                        <td>
                          <button className="adm-text-btn" style={{ padding: 0, textAlign: 'left' }} onClick={() => setSelected(u)}>
                            {u.display_name || <span className="adm-muted">—</span>}
                          </button>
                        </td>
                        <td className="adm-muted" style={{ fontSize: 12 }}>{maskEmail(u.email)}</td>
                        <td><span className="adm-chip">{u.plan_tier}</span></td>
                        <td>{statusChip(u.status)}</td>
                        <td className="adm-muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="adm-muted" style={{ textAlign: 'center' }}>{u.envelope_count}</td>
                        <td className="adm-muted" style={{ textAlign: 'center' }}>{u.device_count}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="adm-text-btn" onClick={() => setSelected(u)}>View</button>
                            {u.status !== 'suspended'
                              ? <button className="adm-text-btn" style={{ color: '#C23232' }}
                                  disabled={actionBusy === u.id}
                                  onClick={() => { setReasonModal({ userId: u.id, action: 'suspend' }); setReason('') }}>
                                  Suspend
                                </button>
                              : <button className="adm-text-btn" style={{ color: '#1E7E34' }}
                                  disabled={actionBusy === u.id}
                                  onClick={() => { setReasonModal({ userId: u.id, action: 'reactivate' }); setReason('') }}>
                                  Reactivate
                                </button>
                            }
                          </div>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          )
        }
      </div>
      {reasonModal && (
        <div className="adm-modal-overlay" onClick={() => setReasonModal(null)}>
          <div className="adm-modal" onClick={e => e.stopPropagation()}>
            <h3>{reasonModal.action === 'suspend' ? 'Suspend account' : 'Reactivate account'}</h3>
            <p className="adm-muted" style={{ marginBottom: 12 }}>Type a reason. This is logged and cannot be deleted.</p>
            <textarea className="adm-textarea" rows={3} value={reason} onChange={e => setReason(e.target.value)}
              placeholder="e.g. Reported for abuse, ticket #1234" />
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button className="adm-btn-primary" style={{ flex: 1 }} disabled={!reason.trim() || !!actionBusy} onClick={doAction}>
                {actionBusy ? 'Please wait…' : 'Confirm'}
              </button>
              <button className="adm-btn-ghost" style={{ flex: 1 }} onClick={() => setReasonModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Audit log panel ──────────────────────────────────────────────────────────
function AuditPanel({ audit }: { audit: AuditItem[] }) {
  return (
    <div className="adm-panel-page">
      <div className="adm-panel">
        <div className="adm-section-head">
          <span>Audit log</span>
          <span className="adm-muted" style={{ fontSize: 12 }}>Read-only · cannot be edited or deleted</span>
        </div>
        {audit.length === 0
          ? <p className="adm-muted">No admin actions recorded yet.</p>
          : (
            <table className="adm-table">
              <thead>
                <tr><th>Time</th><th>Admin</th><th>Action</th><th>Target</th></tr>
              </thead>
              <tbody>
                {audit.map(r => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(r.at).toLocaleString()}</td>
                    <td className="adm-muted" style={{ fontSize: 12 }}>{r.actor_id.slice(0, 8)}…</td>
                    <td style={{ textTransform: 'capitalize' }}>{r.action.replace(/_/g, ' ')}</td>
                    <td className="adm-muted">{r.object_type} · {r.object_id.slice(0, 8)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export function AdminScreen() {
  const [identifier, setIdentifier] = useState('')
  const [code, setCode]             = useState('')
  const [devCode, setDevCode]       = useState('')
  const [busy, setBusy]             = useState(false)
  const [error, setError]           = useState('')
  const [stage, setStage]           = useState<'auth' | 'loading' | 'dashboard'>(
    localStorage.getItem('access_token') ? 'loading' : 'auth'
  )
  const [section, setSection]       = useState<Section>('overview')
  const [adminName, setAdminName]   = useState('')
  const [metrics, setMetrics]       = useState<Metrics | null>(null)
  const [audit, setAudit]           = useState<AuditItem[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const loadDashboard = useCallback(async () => {
    setError('')
    setStage('loading')
    try {
      const token = localStorage.getItem('access_token')
      const me = await fetch('/api/v1/auth/me', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!me.ok) throw new Error('Could not verify this account.')
      const profile = await me.json() as { id: string; display_name?: string; email?: string }
      setAdminName(profile.display_name || profile.email || 'Admin')

      const [m, a] = await Promise.all([
        adminFetch<Metrics>('/metrics'),
        adminFetch<{ items: AuditItem[] }>('/audit-log?limit=50'),
      ])
      setMetrics(m)
      setAudit(a.items)
      setStage('dashboard')
    } catch (e) {
      setStage('auth')
      const msg = e instanceof Error ? e.message : 'Could not load admin dashboard.'
      setError(msg.includes('Admin access required')
        ? 'This account is not on the admin allowlist. Add its user ID to ADMIN_USER_IDS in apps/api/.env and restart the API.'
        : msg)
    }
  }, [])

  useEffect(() => {
    if (stage === 'loading') void loadDashboard()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const requestCode = async () => {
    setBusy(true); setError(''); setDevCode('')
    try {
      const res = await fetch('/api/v1/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() }),
      })
      const body = await res.json().catch(() => null) as { _dev_code?: string; detail?: string } | null
      if (!res.ok) throw new Error(typeof body?.detail === 'string' ? body.detail : `HTTP ${res.status}`)
      setDevCode(body?._dev_code ?? '')
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not send code.') }
    finally { setBusy(false) }
  }

  const verifyCode = async () => {
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/v1/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), code: code.trim() }),
      })
      const body = await res.json().catch(() => null) as { access_token?: string; refresh_token?: string; detail?: string } | null
      if (!res.ok || !body?.access_token || !body.refresh_token)
        throw new Error(typeof body?.detail === 'string' ? body.detail : `HTTP ${res.status}`)
      setTokens(body.access_token, body.refresh_token)
      void loadDashboard()
    } catch (e) { setError(e instanceof Error ? e.message : 'Verification failed.') }
    finally { setBusy(false) }
  }

  const signOut = () => {
    clearTokens(); setStage('auth'); setMetrics(null); setAudit([])
    setCode(''); setDevCode(''); setError(''); setAdminName('')
  }

  // ── Auth screen ────────────────────────────────────────────────────────────
  if (stage === 'loading') {
    return (
      <div className="adm-auth-page">
        <div className="adm-auth-card">
          <div className="adm-auth-logo"><span className="adm-auth-wordmark">Pocki<span>va</span></span><span className="adm-badge-pill">ADMIN</span></div>
          <p style={{ color: '#596781', textAlign: 'center', marginTop: 24 }}>Checking admin access…</p>
        </div>
      </div>
    )
  }

  if (stage === 'auth') {
    return (
      <div className="adm-auth-page">
        <div className="adm-auth-card">
          <div className="adm-auth-logo">
            <span className="adm-auth-wordmark">Pocki<span>va</span></span>
            <span className="adm-badge-pill">ADMIN</span>
          </div>
          <p className="adm-auth-restricted">RESTRICTED ACCESS</p>
          <h2 className="adm-auth-heading">Sign in to admin console</h2>
          <p className="adm-auth-sub">Authorised admin accounts only. Every action is logged.</p>

          <label className="adm-auth-label">Email or phone</label>
          <input className="adm-auth-input" autoComplete="username" value={identifier}
            onChange={e => setIdentifier(e.target.value)} placeholder="name@example.com or +254…" />
          <button className="adm-btn-primary" style={{ marginTop: 10 }} disabled={busy || !identifier.trim()} onClick={requestCode}>
            {busy ? 'Please wait…' : 'Send verification code'}
          </button>

          {devCode && (
            <div className="adm-dev-code">
              <strong>Dev code</strong>
              <span>{devCode}</span>
              <small>Only shown in local development.</small>
            </div>
          )}

          <label className="adm-auth-label" style={{ marginTop: 16 }}>Verification code</label>
          <input className="adm-auth-input" inputMode="numeric" autoComplete="one-time-code"
            value={code} onChange={e => setCode(e.target.value)} placeholder="6-digit code"
            onKeyDown={e => e.key === 'Enter' && void verifyCode()} />
          <button className="adm-btn-primary" style={{ marginTop: 10 }} disabled={busy || !code.trim()} onClick={verifyCode}>
            Verify and continue
          </button>

          {error && <p className="adm-error" role="alert">{error}</p>}
        </div>
      </div>
    )
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────
  return (
    <div className="adm-shell">
      {/* Amber warning strip */}
      <div className="adm-warning-strip">
        You are in the admin console. Every action is logged.
      </div>

      <div className="adm-body">
        {/* Sidebar */}
        <aside className={`adm-sidebar${sidebarOpen ? ' adm-sidebar--open' : ''}`}>
          <div className="adm-sidebar__brand">
            <span className="adm-sidebar__wordmark">Pocki<span>va</span></span>
            <span className="adm-badge-pill">ADMIN</span>
          </div>

          <nav className="adm-sidebar__nav">
            {NAV.map(item => (
              <button
                key={item.id}
                className={`adm-nav-item${section === item.id ? ' adm-nav-item--active' : ''}`}
                onClick={() => { setSection(item.id); setSidebarOpen(false) }}
              >
                <span className="adm-nav-item__icon">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="adm-sidebar__footer">
            <div className="adm-sidebar__admin-info">
              <div className="adm-sidebar__avatar">{adminName.charAt(0).toUpperCase()}</div>
              <div>
                <div className="adm-sidebar__admin-name">{adminName}</div>
                <div className="adm-sidebar__admin-role">Owner</div>
              </div>
            </div>
            <button className="adm-signout-btn" onClick={signOut}>Sign out</button>
          </div>
        </aside>

        {/* Main area */}
        <div className="adm-main">
          {/* Top bar */}
          <header className="adm-topbar">
            <div className="adm-topbar__left">
              <button className="adm-hamburger" onClick={() => setSidebarOpen(o => !o)} aria-label="Menu">☰</button>
              <div>
                <div className="adm-topbar__title">{PAGE_TITLES[section]}</div>
                <div className="adm-topbar__breadcrumb">Admin / {PAGE_TITLES[section]}</div>
              </div>
            </div>
            <div className="adm-topbar__search-wrap">
              <input className="adm-topbar__search" placeholder="Find a user by email, phone or ID…" />
            </div>
            <div className="adm-topbar__right">
              <span className="adm-env-tag">Production</span>
              <button className="adm-icon-btn" title="Alerts">🔔</button>
              <div className="adm-sidebar__avatar" style={{ cursor: 'pointer' }}>{adminName.charAt(0).toUpperCase()}</div>
            </div>
          </header>

          {/* Content */}
          <div className="adm-content">
            {error && <p className="adm-error" role="alert" style={{ marginBottom: 16 }}>{error}</p>}

            {section === 'overview' && (
              <OverviewPanel metrics={metrics} audit={audit} onRefresh={loadDashboard} />
            )}
            {section === 'users' && <UsersPanel />}
            {section === 'billing' && (
              <StubPanel title="Billing" description="M-Pesa STK payments, refunds, and Daraja reconciliation — coming soon." />
            )}
            {section === 'plans' && (
              <StubPanel title="Plans & pricing" description="Edit plan prices, trial length, promo codes, and price tests — coming soon." />
            )}
            {section === 'partners' && (
              <StubPanel title="Partners" description="Banks, SACCOs, and employer plans with aggregate member counts — coming soon." />
            )}
            {section === 'support' && (
              <StubPanel title="Support" description="Ticket inbox, canned replies, deletion and export requests — coming soon." />
            )}
            {section === 'content' && (
              <StubPanel title="Content" description="Encouragement banners, proverbs, announcements, and help pages — coming soon." />
            )}
            {section === 'flags' && (
              <StubPanel title="Feature flags" description="Toggle features per plan or percentage of users — coming soon." />
            )}
            {section === 'health' && (
              <StubPanel title="System health" description="API, database, queue, and M-Pesa callback status — coming soon." />
            )}
            {section === 'audit' && <AuditPanel audit={audit} />}
            {section === 'team' && (
              <StubPanel title="Admin team" description="Add admins, assign roles, and require 2FA — coming soon." />
            )}
          </div>
        </div>
      </div>

      {/* Sidebar overlay on mobile */}
      {sidebarOpen && <div className="adm-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
    </div>
  )
}
