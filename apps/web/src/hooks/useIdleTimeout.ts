import { useEffect, useRef, useCallback } from 'react'
import { clearTokens } from '@/lib/api'
import { useStore } from '@/store'

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'] as const
const CHECK_INTERVAL_MS = 30_000 // check every 30s

interface Options {
  /** Idle timeout in minutes. Default 15. Set 0 to disable. */
  timeoutMinutes?: number
  /** Show a warning before logout (minutes before expiry). Default 2. */
  warnBeforeMinutes?: number
  /** Called when the user is logged out due to inactivity. */
  onIdle?: () => void
}

/**
 * useIdleTimeout : logs the user out after a period of inactivity.
 *
 * Tracks user activity (mouse, keyboard, touch, scroll) and starts a
 * countdown. If no activity is detected within the timeout window,
 * the session is cleared and the user is redirected to the welcome screen.
 *
 * A warning toast is shown N minutes before the idle logout fires.
 */
export function useIdleTimeout({
  timeoutMinutes = 15,
  warnBeforeMinutes = 2,
  onIdle,
}: Options = {}) {
  const clearAuth = useStore(s => s.clearAuth)
  const lastActivityRef = useRef<number>(Date.now())
  const warnedRef = useRef(false)
  const timeoutMs = timeoutMinutes * 60_000
  const warnMs = warnBeforeMinutes * 60_000

  const doLogout = useCallback(() => {
    clearTokens()
    clearAuth()
    onIdle?.()
  }, [clearAuth, onIdle])

  // Track activity
  useEffect(() => {
    if (timeoutMinutes <= 0) return

    const update = () => {
      lastActivityRef.current = Date.now()
      warnedRef.current = false
    }

    ACTIVITY_EVENTS.forEach(ev =>
      window.addEventListener(ev, update, { passive: true })
    )

    return () => {
      ACTIVITY_EVENTS.forEach(ev =>
        window.removeEventListener(ev, update)
      )
    }
  }, [timeoutMinutes])

  // Check for idle periodically
  useEffect(() => {
    if (timeoutMinutes <= 0) return

    const check = () => {
      const elapsed = Date.now() - lastActivityRef.current

      // Show warning toast before logout
      if (elapsed >= timeoutMs - warnMs && !warnedRef.current) {
        warnedRef.current = true
        // Dispatch a custom event so ToastContainer can pick it up
        // without importing the toast module directly (avoids circular deps)
        window.dispatchEvent(new CustomEvent('pockiva:idle-warning', {
          detail: { minutesLeft: warnBeforeMinutes },
        }))
      }

      // Logout if idle timeout exceeded
      if (elapsed >= timeoutMs) {
        doLogout()
      }
    }

    const interval = setInterval(check, CHECK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [timeoutMinutes, timeoutMs, warnMs, warnBeforeMinutes, doLogout])

  return {
    /** Manually reset the idle timer (e.g. after a modal interaction). */
    reset: () => {
      lastActivityRef.current = Date.now()
      warnedRef.current = false
    },
  }
}