import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { BrandWordmark } from '@/components/BrandWordmark'
import { useStore } from '@/store'

export function VerifyReturnScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { identifier: string; devCode?: string } | null
  const { setLastVerifiedAt } = useStore()

  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [resendSecs, setResendSecs] = useState(30)
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (!state?.identifier) { navigate('/confirm-identity', { replace: true }); return }
    inputs.current[0]?.focus()
  }, [])

  useEffect(() => {
    if (resendSecs <= 0) return
    const id = setTimeout(() => setResendSecs(s => s - 1), 1000)
    return () => clearTimeout(id)
  }, [resendSecs])

  const handleChange = (i: number, val: string) => {
    if (val.length > 1) {
      const clean = val.replace(/\D/g, '').slice(0, 6)
      const next = [...digits]
      for (let j = 0; j < 6; j++) next[j] = clean[j] ?? ''
      setDigits(next)
      inputs.current[Math.min(clean.length, 5)]?.focus()
      if (clean.length === 6) void submit(clean)
      return
    }
    if (!/^\d?$/.test(val)) return
    const next = [...digits]
    next[i] = val
    setDigits(next)
    if (val && i < 5) inputs.current[i + 1]?.focus()
    if (next.every(d => d) && next.join('').length === 6) void submit(next.join(''))
  }

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus()
  }

  const submit = async (code: string) => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/v1/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: state!.identifier, code }),
      })
      const data = await res.json().catch(() => null) as { access_token?: string; refresh_token?: string; detail?: string } | null
      if (!res.ok || !data?.access_token) throw new Error(data?.detail ?? 'Invalid code.')

      // Update the verification timestamp — no PIN needed, device key is still valid
      setLastVerifiedAt(Date.now())
      navigate('/app/', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not verify code.')
      setDigits(['', '', '', '', '', ''])
      inputs.current[0]?.focus()
    } finally { setBusy(false) }
  }

  const resend = async () => {
    if (resendSecs > 0) return
    setResendSecs(30)
    setError('')
    await fetch('/api/v1/auth/otp/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: state!.identifier }),
    })
  }

  return (
    <div className="auth-page">
      <button className="auth-back-btn" onClick={() => navigate('/confirm-identity')} aria-label="Back">← Back</button>
      <div className="auth-card">
        <div className="auth-logo">
          <img src="/icon.svg" alt="Pockiva" className="auth-icon" />
          <span className="auth-wordmark"><BrandWordmark /></span>
        </div>

        <h2 className="auth-heading">Enter your code</h2>
        <p className="auth-sub">
          We sent a 6-digit code to <strong>{state?.identifier}</strong>.
        </p>

        {state?.devCode && (
          <div className="auth-dev-code">
            <span>Dev code</span>
            <strong>{state.devCode}</strong>
          </div>
        )}

        <div className="auth-otp-row">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => { inputs.current[i] = el }}
              value={d}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onPaste={e => { e.preventDefault(); handleChange(i, e.clipboardData.getData('text')) }}
              inputMode="numeric"
              maxLength={6}
              className={`auth-otp-box${error ? ' auth-otp-box--error' : ''}`}
            />
          ))}
        </div>

        {error && <p className="auth-error" role="alert">{error}</p>}

        <button
          className="auth-btn-primary"
          onClick={() => submit(digits.join(''))}
          disabled={busy || digits.join('').length < 6}
        >
          {busy ? 'Verifying…' : 'Verify and continue'}
        </button>

        <p className="auth-switch">
          {resendSecs > 0
            ? `Resend in ${resendSecs}s`
            : <button onClick={resend} className="auth-link">Resend code</button>
          }
        </p>
      </div>
    </div>
  )
}
