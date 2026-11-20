import { useNavigate } from 'react-router-dom'

export function TermsScreen() {
  const navigate = useNavigate()
  return (
    <div className="ld-page">
      <div className="ld-container" style={{ maxWidth: 760 }}>
        <header className="ld-header">
          <a className="ld-logo" href="/">Pock<span>iva</span></a>
          <button className="ld-btn-ghost" onClick={() => navigate(-1)}>← Back</button>
        </header>
        <div style={{ padding: '48px 64px 64px', background: '#fff', flex: 1 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#102D59', letterSpacing: '-.03em', marginBottom: 8 }}>Terms of Service</h1>
          <p style={{ fontSize: 13, color: '#61718F', marginBottom: 32 }}>Last updated: January 2025</p>

          {[
            { h: 'Acceptance', p: 'By using Pockiva you agree to these terms. If you do not agree, please do not use the service.' },
            { h: 'The service', p: 'Pockiva is a personal budgeting tool. It helps you plan and track your own money. It is not a bank, payment service, or financial advisor.' },
            { h: 'Your account', p: 'You are responsible for keeping your PIN secure. We recommend saving your recovery code in a safe place. If you lose your PIN and recovery code, we cannot recover your encrypted data.' },
            { h: 'Subscription', p: 'The free plan includes core budgeting features. Pockiva Plus is KES 199 per month, billed monthly. You may cancel at any time. No refunds for partial months.' },
            { h: 'Limitation of liability', p: 'Pockiva is provided as-is. We are not liable for any financial decisions you make based on data in the app. Always verify important figures independently.' },
            { h: 'Changes', p: 'We may update these terms from time to time. Continued use of the service after changes constitutes acceptance of the new terms.' },
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
