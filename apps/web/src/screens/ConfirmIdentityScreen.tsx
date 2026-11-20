import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BrandWordmark } from '@/components/BrandWordmark'
import { getMeta } from '@/lib/db'

export function ConfirmIdentityScreen() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [initial, setInitial] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getMeta<string>('user_email').then(e => { if (e) setEmail(e) }).catch(() => {})
    getMeta<string>('user_name').then(n => {
      if (n) setInitial(n.charAt(0).toUpperCase())
    }).catch(() => {})
  }, [])

  const sendCode = async () => {
    setBusy(true)
    setError('')
    try {
      const identifier = email
      if (!identifier) throw new Error('No registered email found. Please sign in again.')
      const res = await fetch('/api/v1/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      })
      const result = await res.json().catch(() => null) as { _dev_code?: string; detail?: string } | null
      if (!res.ok) throw new Error(result?.detail ?? 'Could not send code.')
      navigate('/verify-return', { state: { identifier, devCode: result?._dev_code ?? '' } })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send verification code.')
    } finally { setBusy(false) }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <img src="/icon.svg" alt="Pockiva" className="auth-icon" />
          <span className="auth-wordmark"><BrandWordmark /></span>
        </div>

        {initial && <div className="confirm-id__avatar">{initial}</div>}

        <h2 className="auth-heading">Confirm it's you</h2>
        <p className="auth-sub">
          You have been away for a while. We need to verify it's still you before unlocking your account.
        </p>

        {email && (
          <div className="auth-field">
            <input
              className="auth-input"
              value={email}
              readOnly
              aria-label="Your registered email"
              style={{ color: 'var(--color-text-muted)', cursor: 'default' }}
            />
          </div>
        )}

        {error && <p className="auth-error" role="alert">{error}</p>}

        <button className="auth-btn-primary" onClick={sendCode} disabled={busy || !email}>
          {busy ? 'Sending code…' : 'Send code'}
        </button>

        <p className="auth-switch">
          Not you?{' '}
          <button className="auth-link" onClick={() => navigate('/welcome', { replace: true })}>
            Sign in with a different account
          </button>
        </p>
      </div>
    </div>
  )
}
