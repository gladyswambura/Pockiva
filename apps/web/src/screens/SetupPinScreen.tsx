import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { setMeta } from '@/lib/db'
import { useStore } from '@/store'
import { generateDek, wrapDek, wrapDekWithDeviceKey, exportDekAsRecoveryCode } from '@/lib/crypto'
import { Shield, Delete } from 'lucide-react'

const PIN_LENGTH = 4

export function SetupPinScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { name?: string } | null
  const { setDek, setWrappedDek, setDeviceKey } = useStore()

  const [phase, setPhase] = useState<'create' | 'confirm'>('create')
  const [pin, setPin] = useState('')
  const [firstPin, setFirstPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const press = async (key: string) => {
    if (busy) return
    setError('')

    if (key === '⌫') {
      setPin(p => p.slice(0, -1))
      return
    }

    const next = pin + key
    if (next.length > PIN_LENGTH) return
    setPin(next)

    if (next.length < PIN_LENGTH) return

    if (phase === 'create') {
      setFirstPin(next)
      setPhase('confirm')
      setPin('')
      return
    }

    // confirm phase
    if (next !== firstPin) {
      setError('PINs do not match. Try again.')
      setPhase('create')
      setFirstPin('')
      setPin('')
      return
    }

    setBusy(true)
    try {
      const dek = await generateDek()
      const wrapped = await wrapDek(dek, next)
      setDek(dek)
      setWrappedDek(wrapped)
      await setMeta('wrapped_dek', wrapped)
      const { wrappedB64, deviceKey } = await wrapDekWithDeviceKey(dek)
      setDeviceKey(deviceKey)
      await setMeta('device_wrapped_dek', wrappedB64)
      await setMeta('device_key_created_at', new Date().toISOString())
      const recoveryCode = await exportDekAsRecoveryCode(dek)
      navigate('/setup/recovery', { replace: true, state: { recoveryCode, name: state?.name } })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not set up PIN.')
      setPhase('create')
      setFirstPin('')
      setPin('')
    } finally { setBusy(false) }
  }

  const dots = Array.from({ length: PIN_LENGTH }, (_, i) => i < pin.length)
  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫']

  return (
    <div className="pin-page">
      <button className="auth-back-btn" onClick={() => navigate(-1)} aria-label="Go back">← Back</button>

      <div className="pin-page__top">
        <div className="auth-icon-badge">
          <Shield size={22} strokeWidth={2} />
        </div>
        <h1 className="pin-page__heading">
          {phase === 'create' ? 'Create your PIN' : 'Confirm your PIN'}
        </h1>
        <p className="pin-page__sub">
          {phase === 'create'
            ? 'Your PIN locks your envelope names and notes.'
            : 'Enter the same PIN again to confirm.'}
        </p>

        {error && <p className="auth-error" role="alert" style={{ textAlign: 'center' }}>{error}</p>}

        <div className="pin-dots" aria-label={`${pin.length} of ${PIN_LENGTH} digits entered`}>
          {dots.map((filled, i) => (
            <div key={i} className={`pin-dot${filled ? ' pin-dot--filled' : ''}`} />
          ))}
        </div>
      </div>

      <div className="pin-keypad" role="group" aria-label="PIN keypad">
        {keys.map((k, i) => {
          if (k === '') return <div key={i} />
          return (
            <button
              key={i}
              className={`pin-key${k === '⌫' ? ' pin-key--del' : ''}`}
              onClick={() => press(k)}
              aria-label={k === '⌫' ? 'Delete' : k}
              disabled={busy}
            >
              {k === '⌫' ? <Delete size={22} strokeWidth={2} /> : k}
            </button>
          )
        })}
      </div>

      {busy && <p className="pin-page__saving">Setting up…</p>}
    </div>
  )
}
