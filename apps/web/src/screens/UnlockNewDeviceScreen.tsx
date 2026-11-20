import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMeta, setMeta } from '@/lib/db'
import { useStore } from '@/store'
import { unwrapDek, wrapDekWithDeviceKey, type WrappedDek } from '@/lib/crypto'
import { Lock } from 'lucide-react'

export function UnlockNewDeviceScreen() {
  const navigate = useNavigate()
  const { setDek, setDeviceKey, setLastVerifiedAt } = useStore()

  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleKeyPress = (digit: string) => {
    if (busy || pin.length >= 4) return
    const next = pin + digit
    setPin(next)
    setError('')
    if (next.length === 4) void unlock(next)
  }

  const handleDelete = () => {
    if (busy) return
    setPin(p => p.slice(0, -1))
  }

  const unlock = async (code: string) => {
    if (busy) return
    setError('')
    setBusy(true)
    try {
      const savedWrapped = await getMeta<WrappedDek>('wrapped_dek')
      if (!savedWrapped) throw new Error('No saved key on this device. Use your recovery code.')
      const dek = await unwrapDek(savedWrapped, code)
      setDek(dek)
      const { wrappedB64, deviceKey } = await wrapDekWithDeviceKey(dek)
      setDeviceKey(deviceKey)
      await setMeta('device_wrapped_dek', wrappedB64)
      await setMeta('device_key_created_at', new Date().toISOString())
      setLastVerifiedAt(Date.now())
      navigate('/app/', { replace: true })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not unlock.'
      setError(msg.toLowerCase().includes('operationerror') || e instanceof DOMException
        ? 'Incorrect PIN. Try again or use your recovery code.'
        : msg)
      setPin('')
    } finally { setBusy(false) }
  }

  return (
    <div className="lock-page lock-page--new-device">
      <div className="lock-page__top">
        <div className="new-device__lock-tile"><Lock size={28} strokeWidth={2} /></div>
        <h1 className="lock-page__heading" style={{ fontSize: 20 }}>Unlock your names</h1>
        <p className="lock-page__sub" style={{ maxWidth: 260 }}>
          This is a new device. Enter your PIN to read your envelope names and notes.
        </p>

        <div className="lock-page__dots" aria-label={`${pin.length} of 4 digits entered`}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`lock-page__dot${i < pin.length ? ' lock-page__dot--filled' : ''}`} />
          ))}
        </div>

        {error && <p className="lock-page__error" role="alert">{error}</p>}
      </div>

      <div className="lock-page__keypad-panel">
        <div className="lock-keypad">
          {['1','2','3','4','5','6','7','8','9'].map(d => (
            <button key={d} className="lock-keypad__key" onClick={() => handleKeyPress(d)} disabled={busy}>{d}</button>
          ))}
          <div className="lock-keypad__blank" />
          <button className="lock-keypad__key" onClick={() => handleKeyPress('0')} disabled={busy}>0</button>
          <button className="lock-keypad__key lock-keypad__key--del" onClick={handleDelete} disabled={busy} aria-label="Delete">⌫</button>
        </div>

        <div className="new-device__links">
          <button className="new-device__link" onClick={() => navigate('/welcome')}>Forgot my PIN</button>
          <button className="new-device__link" onClick={() => navigate('/unlock/recovery')}>Use recovery code</button>
        </div>
      </div>
    </div>
  )
}
