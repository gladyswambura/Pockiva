import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { BrandWordmark } from '@/components/BrandWordmark'
import { showToast } from '@/components/Toast'
import { Shield } from 'lucide-react'

export function SetupRecoveryScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { recoveryCode: string; name?: string } | null
  const [saved, setSaved] = useState(false)

  if (!state?.recoveryCode) {
    navigate('/welcome', { replace: true })
    return null
  }

  const { recoveryCode } = state

  const handleCopy = () => {
    navigator.clipboard.writeText(recoveryCode)
      .then(() => { showToast('Recovery code copied.'); setSaved(true) })
      .catch(() => showToast('Copy failed — select and copy the code manually.'))
  }

  const handleDownload = () => {
    const blob = new Blob([`Pockiva recovery code\n\n${recoveryCode}\n\nKeep this somewhere safe and private.`], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pockiva-recovery-code.txt'
    a.click()
    URL.revokeObjectURL(url)
    setSaved(true)
  }

  return (
    <div className="auth-page">
      <button className="auth-back-btn" onClick={() => navigate(-1)} aria-label="Back">← Back</button>
      <div className="auth-card">
        <div className="auth-logo">
          <img src="/icon.svg" alt="Pockiva" className="auth-icon" />
          <span className="auth-wordmark"><BrandWordmark /></span>
        </div>

        <div className="auth-icon-badge">
          <Shield size={22} strokeWidth={2} />
        </div>

        <h2 className="auth-heading">Save your recovery code</h2>
        <p className="auth-sub">This is the only way to recover your encrypted names on a new device if you forget your PIN. Keep it somewhere private and safe.</p>

        <div className="auth-recovery-code" style={{ userSelect: 'all' }}>{recoveryCode}</div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="auth-btn-ghost" onClick={handleCopy} style={{ flex: 1 }}>Copy</button>
          <button className="auth-btn-ghost" onClick={handleDownload} style={{ flex: 1 }}>Download</button>
        </div>

        <button
          className="auth-btn-primary"
          onClick={() => navigate('/setup/plan', { replace: true, state: { name: state.name } })}
          disabled={!saved}
          style={{ marginTop: 16, opacity: saved ? 1 : 0.45 }}
        >
          I saved it — continue
        </button>

        {!saved && (
          <p className="auth-hint">Copy or download the code first to continue.</p>
        )}
      </div>
    </div>
  )
}
