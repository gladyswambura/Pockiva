import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { setMeta } from '@/lib/db'
import { useStore } from '@/store'
import { wrapDek, wrapDekWithDeviceKey, importDekFromRecoveryCode } from '@/lib/crypto'
import { Shield, Delete } from 'lucide-react'

const PIN_LENGTH = 4

export function ResetPinScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { recoveryCode: string } | null
  const { setDek, setWrappedDek, setDeviceKey, setLastVerifiedAt } = useStore()

  const [phase, setPhase] = useState<'create' | 'confirm'>('create')
  const [pin, setPin] = useState('')
  const [firstPin, setFirstPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!state?.recoveryCode) {
    navigate('/unlock/recovery', { replace: true })
    return null
  }

  const press = async (key: string) => {
    if (busy) return
    setError('')

    if (key === '⌫') { setPin(p => p.slice(0, -1)); return }

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

    if (next !== firstPin) {
      setError('PINs do not match. Try again.')
      setPhase('create')
      setFirstPin('')
      setPin('')
      return
    }

    setBusy(true)
    try {
      const dek = await importDekFromRecoveryCode(state.recoveryCode)
      const wrapped = await wrapDek(dek, next)
      setDek(dek)
      setWrappedDek(wrapped)
      await setMeta('wrapped_dek', wrapped)
      const { wrappedB64, deviceKey } = await wrapDekWithDeviceKey(dek)
      setDeviceKey(deviceKey)
      await setMeta('device_wrapped_dek', wrappedB64)
      await setMeta('device_key_created_at', new Date().toISOString())
      setLastVerifiedAt(Date.now())
      navigate('/app/', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save new PIN.')
      setPhase('create')
      setFirstPin('')
      setPin('')
    } finally { setBusy(false) }
  }

  const dots = Array.from({ length: PIN_LENGTH }, (_, i) => i < pin.length)
  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫']

  return (
    <div className="pin-page">
      {/* Two-step progress bar */}
      <div className="reset-pin__progress">
        <div className={`reset-pin__step${phase === 'create' ? ' reset-pin__step--active' : ' reset-pin__step--done'}`} />
        <div className={`reset-pin__step${phase === 'confirm' ? ' reset-pin__step--active' : ''}`} />
      </div>

      <div className="pin-page__top">
        <div className="auth-icon-badge">
          <Shield size={22} strokeWidth={2} />
        </div>
        <h1 className="pin-page__heading">
          {phase === 'create' ? 'Create your new PIN' : 'Confirm your PIN'}
        </h1>
        <p className="pin-page__sub">
          {phase === 'create'
            ? 'Choose a new PIN to protect your envelope names and notes.'
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

      {busy && <p className="pin-page__saving">Saving new PIN…</p>}
    </div>
  )
}
