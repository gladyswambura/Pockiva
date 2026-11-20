import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, BookOpen, Clock, Settings, CircleHelp, Target, ChevronRight, BarChart2, Trash2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useStore } from '@/store'
import { showToast } from '@/components/Toast'

const ITEMS = [
  { label: 'Goals',             icon: Target,        to: '/app/money',    color: '#C6923A', bg: '#FDF6E7' },
  { label: 'Income routine',    icon: ClipboardList,  to: '/app/routine',  color: '#2563EB', bg: '#EFF6FF' },
  { label: 'Journal',           icon: BookOpen,       to: '/app/journal',  color: '#7C3AED', bg: '#F0E9FD' },
  { label: 'History',           icon: Clock,          to: '/app/history',  color: '#0F9FB5', bg: '#E0F9FC' },
  { label: 'Monthly report',    icon: BarChart2,      to: '/app/report',   color: '#16833B', bg: '#E2F1E6' },
  { label: 'Pockiva plan',      icon: ClipboardList,  to: '/app/plan',     color: '#0B2249', bg: '#E8EDF5' },
  { label: 'Settings',          icon: Settings,       to: '/app/settings', color: '#596781', bg: '#F3F5F8' },
  { label: 'Help & FAQ',        icon: CircleHelp,     to: '/#faq-title',   color: '#596781', bg: '#F3F5F8' },
]

export function MoreScreen() {
  const navigate = useNavigate()
  const { clearAuth } = useStore()
  const [confirming, setConfirming] = useState(false)

  const handleClearAll = async () => {
    if (!confirming) { setConfirming(true); return }
    try {
      await apiFetch('/auth/clear-data', { method: 'POST', body: {} }).catch(() => {})
    } finally {
      clearAuth()
      localStorage.clear()
      showToast('All data cleared. Starting fresh.')
      navigate('/', { replace: true })
    }
  }

  return (
    <div className="screen-page">
      <div className="screen-heading">
        <h1>More</h1>
      </div>

      <div className="more-list">
        {ITEMS.map(item => (
          <button
            key={item.label}
            className="more-row"
            onClick={() => navigate(item.to)}
          >
            <span className="more-row__icon" style={{ background: item.bg, color: item.color }}>
              <item.icon size={20} strokeWidth={2} />
            </span>
            <span className="more-row__label">{item.label}</span>
            <ChevronRight size={18} className="more-row__chevron" />
          </button>
        ))}

        {/* Clear everything */}
        <button
          className="more-row more-row--danger"
          onClick={handleClearAll}
          style={{ marginTop: 24 }}
        >
          <span className="more-row__icon" style={{ background: '#FEE2E2', color: '#DC2626' }}>
            <Trash2 size={20} strokeWidth={2} />
          </span>
          <span className="more-row__label" style={{ color: '#DC2626' }}>
            {confirming ? 'Tap again to confirm — this cannot be undone' : 'Clear everything & start fresh'}
          </span>
          <ChevronRight size={18} className="more-row__chevron" style={{ color: '#DC2626' }} />
        </button>
        {confirming && (
          <button
            className="btn btn--ghost"
            style={{ marginTop: 6, fontSize: 13, color: 'var(--color-text-muted)' }}
            onClick={() => setConfirming(false)}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
