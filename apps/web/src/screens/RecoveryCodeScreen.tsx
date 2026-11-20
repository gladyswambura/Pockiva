import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { importDekFromRecoveryCode } from '@/lib/crypto'
import { KeyRound } from 'lucide-react'

export function RecoveryCodeScreen() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Normalise: strip whitespace/dashes, uppercase
  const normalise = (raw: string) => raw.replace(/[\s\-]/g, '').toUpperCase()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('')
    setCode(e.target.value)
  }

  const handleContinue = async () => {
    const clean = normalise(code)
    if (!clean) { setError('Paste or type your recovery code.'); return }
    setBusy(true)
    setError('')
    try {
      // Validate the code can actually import a DEK — catches malformed codes early
      const dek = await importDekFromRecoveryCode(clean)
      // Pass the validated DEK (as the raw code) to the reset-PIN screen
      navigate('/reset-pin', { state: { recoveryCode: clean, dek } })
    } catch {
      setError('That recovery code is not valid. Check it and try again.')
    } finally { setBusy(false) }
  }

  return (
    <div className="lock-page lock-page--new-device">
      <div className="lock-page__top">
        <div className="new-device__lock-tile">
          <KeyRound size={28} strokeWidth={2} />
        </div>
        <h1 className="lock-page__heading" style={{ fontSize: 20 }}>Use your recovery code</h1>
        <p className="lock-page__sub" style={{ maxWidth: 280 }}>
          Enter the recovery code you saved when you set up Pockiva. It unlocks your encrypted names.
        </p>

        <input
          className="auth-input"
          value={code}
          onChange={handleChange}
          placeholder="Paste your recovery code"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          style={{ width: '100%', maxWidth: 320, fontFamily: 'ui-monospace, monospace', fontSize: 14, letterSpacing: '0.05em' }}
        />

        {error && <p className="lock-page__error" role="alert" style={{ marginTop: 8 }}>{error}</p>}

        <div className="recovery-notice">
          Keep your recovery code somewhere safe. Anyone with it can access your encrypted data.
        </div>
      </div>

      <div className="lock-page__keypad-panel">
        <button
          className="lock-keypad__submit"
          onClick={handleContinue}
          disabled={busy || !code.trim()}
          style={{ width: '100%', maxWidth: 320 }}
        >
          {busy ? 'Checking…' : 'Continue'}
        </button>
        <button
          className="new-device__link"
          onClick={() => navigate(-1)}
          style={{ marginTop: 12 }}
        >
          ← Back to PIN
        </button>
      </div>
    </div>
  )
}
