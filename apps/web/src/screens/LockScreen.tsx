import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMeta } from '@/lib/db'
import { useStore } from '@/store'
import { clearTokens } from '@/lib/api'

export function LockScreen() {
  const navigate = useNavigate()
  const { setDek, setLastActive, setLastVerifiedAt, clearAuth } = useStore()
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getMeta<string>('user_name').then(n => setName(n ?? '')).catch(() => {})
  }, [])

  const handleKeyPress = (digit: string) => {
    if (busy || pin.length >= 4) return
    const next = pin + digit
    setPin(next)
    setError('')
    if (next.length === 4) void attemptUnlock(next)
  }

  const handleDelete = () => {
    if (busy) return
    setPin(p => p.slice(0, -1))
  }

  const attemptUnlock = async (code: string) => {
    setBusy(true)
    setError('')
    try {
      const { getMeta: gm } = await import('@/lib/db')
      const { unwrapDek } = await import('@/lib/crypto')
      const wrapped = await gm<import('@/lib/crypto').WrappedDek>('wrapped_dek')
      if (!wrapped) throw new Error('No saved key.')
      const dek = await unwrapDek(wrapped, code)
      setDek(dek)
      setLastActive(Date.now())
      setLastVerifiedAt(Date.now())
      navigate('/app/', { replace: true })
    } catch {
      setError('Incorrect PIN. Try again.')
      setPin('')
    } finally { setBusy(false) }
  }

  const signOut = () => {
    clearTokens()
    clearAuth()
    navigate('/', { replace: true })
  }

  const firstName = name.split(' ')[0] || ''
  const initial = (firstName.charAt(0) || 'P').toUpperCase()

  return (
    <div className="lock-page">
      {/* Top: avatar + greeting + dots */}
      <div className="lock-page__top">
        <div className="lock-page__avatar">{initial}</div>
        <h1 className="lock-page__heading">
          Welcome back{firstName ? `, ${firstName}` : ''}.
        </h1>
        <p className="lock-page__sub">Enter your PIN to unlock</p>

        <div className="lock-page__dots" aria-label={`${pin.length} of 4 digits entered`}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`lock-page__dot${i < pin.length ? ' lock-page__dot--filled' : ''}`} />
          ))}
        </div>

        {error && <p className="lock-page__error" role="alert">{error}</p>}
      </div>

      {/* Bottom: keypad panel */}
      <div className="lock-page__keypad-panel">
        <div className="lock-keypad">
          {['1','2','3','4','5','6','7','8','9'].map(d => (
            <button key={d} className="lock-keypad__key" onClick={() => handleKeyPress(d)} disabled={busy}>{d}</button>
          ))}
          <div className="lock-keypad__blank" />
          <button className="lock-keypad__key" onClick={() => handleKeyPress('0')} disabled={busy}>0</button>
          <button className="lock-keypad__key lock-keypad__key--del" onClick={handleDelete} disabled={busy} aria-label="Delete">⌫</button>
        </div>

        <button className="lock-page__signout" onClick={signOut}>Not you? Sign out</button>
      </div>
    </div>
  )
}
