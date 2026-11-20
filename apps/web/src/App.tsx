import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useStore } from '@/store'
import { BottomNav, QuickActionSheet } from '@/components/Nav'
import { OfflineBanner } from '@/components/Shared'
import { ToastContainer } from '@/components/Toast'
import { LandingScreen } from '@/screens/LandingScreen'
import { WelcomeScreen } from '@/screens/WelcomeScreen'
import { VerifyScreen } from '@/screens/VerifyScreen'
import { SetupPinScreen } from '@/screens/SetupPinScreen'
import { SetupRecoveryScreen } from '@/screens/SetupRecoveryScreen'
import { SetupPlanScreen } from '@/screens/SetupPlanScreen'
import { UnlockNewDeviceScreen } from '@/screens/UnlockNewDeviceScreen'
import { LockScreen } from '@/screens/LockScreen'
import { HomeScreen } from '@/screens/HomeScreen'
import { EnvelopesScreen } from '@/screens/EnvelopesScreen'
import { SavingsScreen } from '@/screens/SavingsScreen'
import { LoansScreen } from '@/screens/LoansScreen'
import { GoalsScreen } from '@/screens/GoalsScreen'
import { RoutineScreen } from '@/screens/RoutineScreen'
import { JournalScreen } from '@/screens/JournalScreen'
import { PlanScreen } from '@/screens/PlanScreen'
import { HistoryScreen } from '@/screens/HistoryScreen'
import { MoneyScreen } from '@/screens/MoneyScreen'
import { MoreScreen } from '@/screens/MoreScreen'
import { SettingsScreen } from '@/screens/SettingsScreen'
import { ReportScreen } from '@/screens/ReportScreen'
import { AdminScreen } from '@/screens/AdminScreen'
import { DemoScreen } from '@/screens/DemoScreen'
import { ConfirmIdentityScreen } from '@/screens/ConfirmIdentityScreen'
import { VerifyReturnScreen } from '@/screens/VerifyReturnScreen'
import { RecoveryCodeScreen } from '@/screens/RecoveryCodeScreen'
import { ResetPinScreen } from '@/screens/ResetPinScreen'
import { getToken, refreshAccessToken } from '@/lib/api'
import { getMeta } from '@/lib/db'
import { unwrapDekWithDeviceKey } from '@/lib/crypto'

// ── AppGuard: checks the 5 routing conditions from spec 1.7 ──────────────────

function AppGuard() {
  const { accessToken, _hasHydrated, dek, deviceKey, setDek, setLastActive,
          lastActive, lastVerifiedAt, lastFullAuthAt, autoLockMinutes, theme, setOnline } = useStore()
  const navigate = useNavigate()
  const [checked, setChecked] = useState(false)
  const [plusOpen, setPlusOpen] = useState(false)

  // Hooks must all run before any early return
  useEffect(() => {
    const on  = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [setOnline])

  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Track user activity for auto-lock
  useEffect(() => {
    const touch = () => setLastActive(Date.now())
    window.addEventListener('pointerdown', touch)
    window.addEventListener('keydown', touch)
    return () => { window.removeEventListener('pointerdown', touch); window.removeEventListener('keydown', touch) }
  }, [setLastActive])

  useEffect(() => {
    if (!_hasHydrated) return

    const run = async () => {
      let token = accessToken || getToken()

      // Condition 1: no access token — try refresh first (Flow D: expired session)
      if (!token) {
        const refreshed = await refreshAccessToken()
        if (refreshed) {
          token = getToken()
          if (token) useStore.getState().setAuth(token, useStore.getState().userId ?? '', useStore.getState().planTier)
        }
        if (!token) {
          const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
          const usedRecentlyEnough = lastFullAuthAt > 0 && (Date.now() - lastFullAuthAt) < SEVEN_DAYS_MS
          navigate(usedRecentlyEnough ? '/lock' : '/welcome', { replace: true })
          setChecked(true); return
        }
      }

      // Condition 3: valid session but no device-wrapped key → new device
      const deviceWrapped = await getMeta<string>('device_wrapped_dek')
      if (!deviceWrapped) { navigate('/unlock/new-device', { replace: true }); setChecked(true); return }

      // Condition 4a: known device but away for 30 days → email re-verification (no PIN)
      const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
      if (Date.now() - lastVerifiedAt > THIRTY_DAYS_MS) {
        navigate('/confirm-identity', { replace: true }); setChecked(true); return
      }

      // Condition 4b: device key exists but idle lock time has passed
      const idleMs = Date.now() - lastActive
      const lockMs = autoLockMinutes * 60 * 1000
      if (idleMs > lockMs && !dek) { navigate('/lock', { replace: true }); setChecked(true); return }

      // Condition 5: valid session, device key, no lock needed — load DEK if not in memory
      if (!dek) {
        if (deviceKey) {
          try {
            const loadedDek = await unwrapDekWithDeviceKey(deviceWrapped, deviceKey)
            setDek(loadedDek)
          } catch { navigate('/lock', { replace: true }); setChecked(true); return }
        } else {
          // deviceKey lost (page reload) — must re-enter PIN to restore DEK
          navigate('/lock', { replace: true }); setChecked(true); return
        }
      }

      setChecked(true)
    }
    void run()
  }, [_hasHydrated])

  if (!_hasHydrated || !checked) return null

  return (
    <div className="app-shell">
      <OfflineBanner />
      <main className="page-content">
        <Routes>
          <Route index             element={<HomeScreen />} />
          <Route path="envelopes" element={<EnvelopesScreen />} />
          <Route path="savings"   element={<SavingsScreen />} />
          <Route path="loans"     element={<LoansScreen />} />
          <Route path="goals"     element={<GoalsScreen />} />
          <Route path="routine"   element={<RoutineScreen />} />
          <Route path="journal"   element={<JournalScreen />} />
          <Route path="plan"      element={<PlanScreen />} />
          <Route path="history"   element={<HistoryScreen />} />
          <Route path="money"     element={<MoneyScreen />} />
          <Route path="more"      element={<MoreScreen />} />
          <Route path="report"    element={<ReportScreen />} />
          <Route path="settings"  element={<SettingsScreen />} />
          <Route path="*"         element={<Navigate to="/app/" replace />} />
        </Routes>
      </main>
      <BottomNav onPlus={() => setPlusOpen(true)} />
      <QuickActionSheet open={plusOpen} onClose={() => setPlusOpen(false)} />
      <ToastContainer />
    </div>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                  element={<LandingScreen />} />
        <Route path="/demo"              element={<DemoScreen />} />
        <Route path="/welcome"           element={<WelcomeScreen />} />
        <Route path="/verify"            element={<VerifyScreen />} />
        <Route path="/setup/pin"         element={<SetupPinScreen />} />
        <Route path="/setup/recovery"    element={<SetupRecoveryScreen />} />
        <Route path="/setup/plan"        element={<SetupPlanScreen />} />
        <Route path="/unlock/new-device" element={<UnlockNewDeviceScreen />} />
        <Route path="/lock"              element={<LockScreen />} />
        <Route path="/confirm-identity"  element={<ConfirmIdentityScreen />} />
        <Route path="/verify-return"     element={<VerifyReturnScreen />} />
        <Route path="/unlock/recovery"   element={<RecoveryCodeScreen />} />
        <Route path="/reset-pin"         element={<ResetPinScreen />} />
        <Route path="/admin"             element={<AdminScreen />} />
        <Route path="/app/*"             element={<AppGuard />} />
      </Routes>
    </BrowserRouter>
  )
}
