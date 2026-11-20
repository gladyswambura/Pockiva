import { useNavigate } from 'react-router-dom'

export function ContactScreen() {
  const navigate = useNavigate()
  return (
    <div className="ld-page">
      <div className="ld-container" style={{ maxWidth: 760 }}>
        <header className="ld-header">
          <a className="ld-logo" href="/">Pock<span>iva</span></a>
          <button className="ld-btn-ghost" onClick={() => navigate(-1)}>← Back</button>
        </header>
        <div style={{ padding: '48px 64px 64px', background: '#fff', flex: 1 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#102D59', letterSpacing: '-.03em', marginBottom: 8 }}>Contact us</h1>
          <p style={{ fontSize: 14, color: '#61718F', lineHeight: 1.65, marginBottom: 40 }}>
            We're a small team building Pockiva in Nairobi. We read every message.
          </p>

          <div style={{ display: 'grid', gap: 16, maxWidth: 480 }}>
            {[
              { label: 'General enquiries', value: 'hello@pockiva.com' },
              { label: 'Privacy & data', value: 'privacy@pockiva.com' },
              { label: 'Support', value: 'support@pockiva.com' },
            ].map(({ label, value }) => (
              <div key={label} style={{ padding: '16px 20px', border: '1px solid #EEE9E1', borderRadius: 12, background: '#FAF7F2' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9A6B19', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                <a href={`mailto:${value}`} style={{ fontSize: 15, fontWeight: 600, color: '#102D59', textDecoration: 'none' }}>{value}</a>
              </div>
            ))}
          </div>

          <p style={{ marginTop: 40, fontSize: 13, color: '#61718F', lineHeight: 1.6 }}>
            We typically respond within one business day. For urgent account issues, include your user ID (found in Settings → Account).
          </p>
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
