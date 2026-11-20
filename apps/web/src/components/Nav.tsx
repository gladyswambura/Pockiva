import { NavLink, useNavigate } from 'react-router-dom'
import { Home, Layers, Wallet, MoreHorizontal, Plus, LogOut, PiggyBank, CreditCard, Target, BookOpen, ClipboardList, Settings, History, Star, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Mail, HandCoins, ArrowRight } from 'lucide-react'
import { useT } from '@/i18n/useT'
import { BottomSheet } from './BottomSheet'
import { clearTokens } from '@/lib/api'
import { useStore } from '@/store'

// All 10 nav items per spec (sidebar + icon rail)
const NAV = [
  { to: '/app/',           icon: Home,           key: 'home' as const },
  { to: '/app/envelopes',  icon: Layers,         key: 'envelopes' as const },
  { to: '/app/savings',    icon: PiggyBank,      key: 'savings' as const },
  { to: '/app/loans',      icon: CreditCard,     key: 'loans' as const },
  { to: '/app/goals',      icon: Target,         key: 'goals' as const },
  { to: '/app/routine',    icon: ClipboardList,  key: 'routine' as const },
  { to: '/app/journal',    icon: BookOpen,       key: 'journal' as const },
  { to: '/app/plan',       icon: Star,           key: 'plan' as const },
  { to: '/app/history',    icon: History,        key: 'history' as const },
  { to: '/app/settings',   icon: Settings,       key: 'settings' as const },
]

// Mobile bottom bar (<768px): Home, Envelopes, +, Money, More
const MOBILE_NAV = [
  { to: '/app/',           icon: Home,           key: 'home' as const },
  { to: '/app/envelopes',  icon: Layers,         key: 'envelopes' as const },
  { to: '/app/money',      icon: Wallet,         key: 'money' as const },
  { to: '/app/more',       icon: MoreHorizontal, key: 'more' as const },
]

export function BottomNav({ onPlus }: { onPlus: () => void }) {
  const t = useT()

  return (
    <>
      {/* Desktop sidebar ≥1024px: all 10 items with labels */}
      <nav className="nav-desktop" aria-label="Main navigation">
        <div className="nav-brand">
          <img src="/logo-reversed.svg" alt="Pockiva" />
        </div>
        {NAV.map(n => <NavItem key={n.key} to={n.to} icon={n.icon} label={t.nav[n.key]} />)}
        <LogoutButton />
      </nav>

      {/* Tablet icon rail 768to1023px: all 10 items icons only */}
      <nav className="nav-tablet" aria-label="Main navigation">
        {NAV.map(n => <NavItem key={n.key} to={n.to} icon={n.icon} label={t.nav[n.key]} />)}
      </nav>

      {/* Mobile bottom bar <768px: Home, Envelopes, +, Money, More */}
      <nav className="nav-mobile" aria-label="Main navigation">
        {MOBILE_NAV.slice(0, 2).map(n => <NavItem key={n.key} to={n.to} icon={n.icon} label={t.nav[n.key]} />)}
        <button onClick={onPlus} aria-label="Quick actions" className="nav-create-button">
          <Plus size={24} strokeWidth={2.5} />
        </button>
        {MOBILE_NAV.slice(2).map(n => <NavItem key={n.key} to={n.to} icon={n.icon} label={t.nav[n.key]} />)}
      </nav>
    </>
  )
}

function LogoutButton() {
  const navigate = useNavigate()
  const clearAuth = useStore(s => s.clearAuth)
  const handleLogout = () => {
    clearTokens()
    clearAuth()
    navigate('/', { replace: true })
  }
  return (
    <button onClick={handleLogout} aria-label="Sign out" className="nav-item nav-logout">
      <LogOut size={22} />
      <span>Sign out</span>
    </button>
  )
}

function NavItem({ to, icon: Icon, label }: { to: string; icon: typeof Home; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/app/'}
      className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}
    >
      <Icon size={22} />
      <span>{label}</span>
    </NavLink>
  )
}

// ── Quick-action sheet (centre + button) ──────────────────────

export function QuickActionSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()

  const actions = [
    { label: 'Add income',    icon: ArrowDownLeft, color: '#16833B', bg: '#E2F1E6', to: '/app/?action=deposit' },
    { label: 'Spend',         icon: ArrowUpRight, color: '#D97706', bg: '#FBE8DC', to: '/app/?action=spend' },
    { label: 'Move money',    icon: ArrowLeftRight, color: '#2563EB', bg: '#EFF6FF', to: '/app/?action=move' },
    { label: 'New envelope',  icon: Mail,          color: '#7C3AED', bg: '#F0E9FD', to: '/app/envelopes?action=new' },
    { label: 'Record a loan', icon: HandCoins,     color: '#DB2777', bg: '#FCE7F1', to: '/app/loans?action=new' },
  ]

  return (
    <BottomSheet open={open} onClose={onClose} title="What do you want to do?">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {actions.map(a => (
          <button
            key={a.label}
            onClick={() => { navigate(a.to); onClose() }}
            className="qa-action"
          >
            <span className="qa-action__icon" style={{ background: a.bg, color: a.color }}>
              <a.icon size={20} strokeWidth={2.2} />
            </span>
            <span className="qa-action__label">{a.label}</span>
            <ArrowRight size={18} className="qa-action__arrow" />
          </button>
        ))}
      </div>
    </BottomSheet>
  )
}