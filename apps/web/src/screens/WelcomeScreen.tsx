import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BrandWordmark } from '@/components/BrandWordmark'

type InputMode = 'email' | 'phone'

function validateEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}
function validatePhone(v: string) {
  return /^[0-9]{9,10}$/.test(v.replace(/\s/g, ''))
}

export function WelcomeScreen() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const isSignIn = searchParams.get('signin') === '1'

  const [mode, setMode] = useState<InputMode>('email')
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const isEmail = mode === 'email'

  const getIdentifier = () =>
    isEmail ? value.trim().toLowerCase() : `+254${value.replace(/^0/, '').replace(/\s/g, '')}`

  const isValid = () =>
    isEmail ? validateEmail(value) : validatePhone(value)

  const handleNext = async () => {
    if (!isValid()) {
      setError(isEmail ? 'Enter a valid email address.' : 'Enter a valid Kenyan phone number.')
      return
    }
    if (!isSignIn && !name.trim()) { setError('Please enter your name.'); return }
    setError('')
    setBusy(true)
    try {
      const identifier = getIdentifier()
      const res = await fetch('/api/v1/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      })
      const result = await res.json().catch(() => null) as { _dev_code?: string; detail?: string } | null
      if (!res.ok || !result) throw new Error(result?.detail ?? `Could not send code (HTTP ${res.status}).`)
      navigate('/verify', {
        state: { identifier, name: name.trim(), isSignIn, devCode: result._dev_code ?? '' },
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send verification code.')
    } finally { setBusy(false) }
  }

  const switchMode = (m: InputMode) => { setMode(m); setValue(''); setError('') }

  return (
    <div className="auth-page">
      <div className="auth-card">

        {/* Logo */}
        <div className="auth-logo"
          onClick={() => navigate('/', { replace: true })}
          role="button" tabIndex={0}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && navigate('/', { replace: true })}
        >
          <img src="/icon.svg" alt="Pockiva" className="auth-icon" />
          <span className="auth-wordmark"><BrandWordmark /></span>
        </div>
        <p className="auth-tagline">Every shilling has a place.</p>

        {/* Name field — sign-up only */}
        {!isSignIn && (
          <div className="auth-field">
            <label className="auth-label" htmlFor="name-input">Your name</label>
            <input
              id="name-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Amina Wanjiku"
              autoComplete="name"
              className="auth-input"
              onKeyDown={e => e.key === 'Enter' && handleNext()}
            />
          </div>
        )}

        {/* Email / Phone toggle */}
        <div className="auth-toggle">
          <button
            className={`auth-toggle__btn${isEmail ? ' auth-toggle__btn--active' : ''}`}
            onClick={() => switchMode('email')}
          >Email</button>
          <button
            className={`auth-toggle__btn${!isEmail ? ' auth-toggle__btn--active' : ''}`}
            onClick={() => switchMode('phone')}
          >Phone</button>
        </div>

        {/* Input */}
        <div className="auth-field">
          <label className="auth-label" htmlFor="identifier-input">
            {isEmail ? 'Your email' : 'Your phone'}
          </label>
          <div className={`auth-input-wrap${!isEmail ? ' auth-input-wrap--phone' : ''}`}>
            {!isEmail && <span className="auth-phone-prefix">+254</span>}
            <input
              id="identifier-input"
              value={value}
              onChange={e => { setValue(e.target.value); setError('') }}
              type={isEmail ? 'email' : 'tel'}
              autoComplete={isEmail ? 'email' : 'tel'}
              inputMode={isEmail ? 'email' : 'numeric'}
              placeholder={isEmail ? 'you@example.com' : '7XX XXX XXX'}
              className="auth-input"
              onKeyDown={e => e.key === 'Enter' && handleNext()}
            />
          </div>
        </div>

        {error && <p className="auth-error" role="alert">{error}</p>}

        <button
          className="auth-btn-primary"
          onClick={handleNext}
          disabled={busy || !value.trim()}
        >
          {busy ? 'Sending code…' : 'Send code'}
        </button>

        <p className="auth-hint">We send a 6-digit code. No password to remember.</p>

        <p className="auth-switch">
          {isSignIn ? (
            <>Don&apos;t have an account?{' '}
              <button onClick={() => { setSearchParams({ signin: '0' }); setError('') }} className="auth-link">Sign up</button>
            </>
          ) : (
            <>Already have an account?{' '}
              <button onClick={() => { setSearchParams({ signin: '1' }); setError('') }} className="auth-link">Sign in</button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
