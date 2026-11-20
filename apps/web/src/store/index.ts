import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WrappedDek } from '@/lib/crypto'

export interface EnvelopeState {
  id: string
  nameEnc: string
  namePlain: string
  groupCode: string
  color: string
  icon: string
  sortOrder: number
  planCents: number
  goalCents: number
  balanceCents: number
  fundedCents: number
  spentCents: number
  lockUntil: string | null
  kind: string
  archivedAt: string | null
}

export interface SummaryState {
  bankBalanceCents: number
  walletCents: number
  envelopesTotalCents: number
  savingsCents: number
  totalOwedCents: number
  netPositionCents: number
  monthlyPlanCents: number
  stillToFundCents: number
  currency: string
}

export interface LoanState {
  id: string
  accountId: string
  lenderEnc: string | null
  lenderPlain: string
  borrowedCents: number
  totalRepayCents: number
  owedCents: number
  monthlyCents: number
  dueDay: number | null
  envelopeBalanceCents: number
}

interface AppStore {
  // Auth
  accessToken: string | null
  userId: string | null
  planTier: string
  setAuth: (token: string, userId: string, tier: string) => void
  setPlanTier: (tier: string) => void
  clearAuth: () => void

  // Encryption
  dek: CryptoKey | null
  wrappedDek: WrappedDek | null
  deviceKey: CryptoKey | null
  setDek: (dek: CryptoKey) => void
  setWrappedDek: (w: WrappedDek) => void
  setDeviceKey: (k: CryptoKey | null) => void

  // Data
  summary: SummaryState | null
  envelopes: EnvelopeState[]
  loans: LoanState[]
  setSummary: (s: SummaryState) => void
  setEnvelopes: (e: EnvelopeState[]) => void
  setLoans: (l: LoanState[]) => void

  // UI / session
  isOnline: boolean
  setOnline: (v: boolean) => void
  locale: string
  currency: string
  theme: 'system' | 'light' | 'dark'
  faithContent: boolean
  autoLockMinutes: number
  lastActive: number        // epoch ms, updated on user interaction
  lastVerifiedAt: number    // epoch ms of last successful email/OTP verification
  lastFullAuthAt: number    // epoch ms of last OTP welcome-flow completion
  isNewUser: boolean        // true after plan setup, cleared once welcome banner dismissed
  setLastActive: (t: number) => void
  setLastVerifiedAt: (t: number) => void
  setLastFullAuthAt: (t: number) => void
  setIsNewUser: (v: boolean) => void
  setPrefs: (p: Partial<{ locale: string; currency: string; theme: 'system' | 'light' | 'dark'; faithContent: boolean; autoLockMinutes: number }>) => void

  // Hydration
  _hasHydrated: boolean
  setHasHydrated: (v: boolean) => void
}

export const useStore = create<AppStore>()(
  persist(
    (set) => ({
      accessToken: null,
      userId: null,
      planTier: 'free',
      setAuth: (token, userId, tier) => set({ accessToken: token, userId, planTier: tier }),
      setPlanTier: (tier) => set({ planTier: tier }),
      clearAuth: () => set({ accessToken: null, userId: null, planTier: 'free', dek: null, deviceKey: null }),

      dek: null,
      wrappedDek: null,
      deviceKey: null,
      setDek: (dek) => set({ dek }),
      setWrappedDek: (w) => set({ wrappedDek: w }),
      setDeviceKey: (k) => set({ deviceKey: k }),

      summary: null,
      envelopes: [],
      loans: [],
      setSummary: (s) => set({ summary: s }),
      setEnvelopes: (e) => set({ envelopes: e }),
      setLoans: (l) => set({ loans: l }),

      isOnline: navigator.onLine,
      setOnline: (v) => set({ isOnline: v }),

      locale: 'en',
      currency: 'KES',
      theme: 'system',
      faithContent: false,
      autoLockMinutes: 5,
      lastActive: Date.now(),
      lastVerifiedAt: Date.now(),
      lastFullAuthAt: 0,
      isNewUser: false,
      setLastActive: (t) => set({ lastActive: t }),
      setLastVerifiedAt: (t) => set({ lastVerifiedAt: t }),
      setLastFullAuthAt: (t) => set({ lastFullAuthAt: t }),
      setIsNewUser: (v) => set({ isNewUser: v }),
      setPrefs: (p) => set((s) => ({ ...s, ...p })),

      _hasHydrated: false,
      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: 'pockiva-store',
      version: 1,
      migrate: (persisted: unknown, version: number) => {
        const s = persisted as Record<string, unknown>
        if (version < 1 && !s.lastFullAuthAt) {
          // Existing users: treat as recently authed so they land on PIN, not welcome
          s.lastFullAuthAt = s.accessToken ? Date.now() : 0
        }
        return s
      },
      partialize: (s) => ({
        accessToken: s.accessToken,
        userId: s.userId,
        planTier: s.planTier,
        wrappedDek: s.wrappedDek,
        locale: s.locale,
        currency: s.currency,
        theme: s.theme,
        faithContent: s.faithContent,
        autoLockMinutes: s.autoLockMinutes,
        lastActive: s.lastActive,
        lastVerifiedAt: s.lastVerifiedAt,
        lastFullAuthAt: s.lastFullAuthAt,
        isNewUser: s.isNewUser,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.setHasHydrated(true)
      },
    }
  )
)
