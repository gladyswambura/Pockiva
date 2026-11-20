import { useNavigate } from 'react-router-dom'

export function PrivacyScreen() {
  const navigate = useNavigate()
  return (
    <div className="ld-page">
      <div className="ld-container" style={{ maxWidth: 760 }}>
        <header className="ld-header">
          <a className="ld-logo" href="/">Pock<span>iva</span></a>
          <button className="ld-btn-ghost" onClick={() => navigate(-1)}>← Back</button>
        </header>
        <div style={{ padding: '48px 64px 64px', background: '#fff', flex: 1 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#102D59', letterSpacing: '-.03em', marginBottom: 8 }}>Privacy Policy</h1>
          <p style={{ fontSize: 13, color: '#61718F', marginBottom: 32 }}>Last updated: January 2025</p>

          {[
            { h: 'What we collect', p: 'Pockiva stores your envelope names, transaction notes, and budget amounts. All of this data is encrypted on your device before it leaves your phone. We cannot read your envelope names or notes.' },
            { h: 'What we never do', p: 'We never read your M-Pesa messages, SMS, or bank statements. We never sell your data to third parties. We never use your financial data for advertising.' },
            { h: 'Your data, your control', p: 'You can export all your data at any time from Settings → Export. You can permanently delete your account and all associated data from Settings → Delete account.' },
            { h: 'Encryption', p: 'Envelope names and transaction notes are encrypted using AES-256 with a key derived from your PIN. Only you hold the key. Even Pockiva staff cannot decrypt your data.' },
            { h: 'Contact', p: 'Questions about privacy? Email us at privacy@pockiva.com or visit our contact page.' },
          ].map(({ h, p }) => (
            <div key={h} style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#102D59', marginBottom: 8 }}>{h}</h2>
              <p style={{ fontSize: 14, color: '#61718F', lineHeight: 1.65, margin: 0 }}>{p}</p>
            </div>
          ))}
        </div>
        <footer className="ld-footer">
          <span>A Skydevs Africa product</span>
          <nav aria-label="Footer links">
            <a href="/privacy">Privacy policy</a>
            <span aria-hidden="true">·</span>
            <a href="/terms">Terms</a>
            <span aria-hidden="true">·</span>
            <a href="/contact">Contact</a>
          </nav>
        </footer>
      </div>
    </div>
  )
}
