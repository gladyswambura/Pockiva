import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Home, ShoppingCart, Bus, AlertCircle, GraduationCap, Plus, Layers, Wallet, MoreHorizontal } from 'lucide-react'
import { useStore } from '@/store'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
function getClockLabel() {
  const now = new Date()
  const h = now.getHours(), m = now.getMinutes().toString().padStart(2, '0')
  return `${h % 12 || 12}:${m}`
}

export function LandingScreen() {
  const navigate = useNavigate()
  const accessToken = useStore(s => s.accessToken)
  const [clock, setClock] = useState(getClockLabel)

  useEffect(() => { if (accessToken) navigate('/app/', { replace: true }) }, [accessToken, navigate])
  useEffect(() => { const id = setInterval(() => setClock(getClockLabel()), 60_000); return () => clearInterval(id) }, [])

  return (
    <div className="ld-page">
      <div className="ld-container">

        {/* ── Header ── */}
        <header className="ld-header">
          <div className="ld-header-inner">
            <a className="ld-logo" href="/" aria-label="Pockiva home">Pock<span>iva</span></a>
            <nav className="ld-nav" aria-label="Site navigation">
              <a href="#how">How it works</a>
              <a href="#privacy">Privacy</a>
              <a href="#pricing">Pricing</a>
            </nav>
            <button className="ld-btn-primary ld-header-cta" onClick={() => navigate('/welcome')}>Get started free</button>
            <button className="ld-btn-ghost ld-mobile-signin" onClick={() => navigate('/welcome?signin=1')}>Sign in</button>
          </div>
        </header>

        {/* ── Hero ── */}
        <section className="ld-hero">
          <div className="ld-hero-inner">
            <div className="ld-hero-copy">
              <h1 className="ld-headline">Every shilling<br />has a place.</h1>
              <p className="ld-subhead">
                Plan your money into envelopes, spend with a note, and never again ask
                &ldquo;where did my 1,000 go?&rdquo;. Private by design.
              </p>
              <div className="ld-ctas">
                <button className="ld-btn-primary" onClick={() => navigate('/welcome')}>Get started free</button>
                <button className="ld-btn-ghost" onClick={() => navigate('/demo')}>See a demo first</button>
              </div>
            </div>

            {/* Phone mockup */}
            <div className="lp-phone" aria-hidden="true">
              <div className="lp-status">
                <span>{clock}</span>
                <div className="lp-status-icons">
                  <span className="lp-dot" /><span className="lp-dot" /><span className="lp-dot" />
                  <span className="lp-battery"><span className="lp-battery-fill" /></span>
                </div>
              </div>
              <div className="lp-content">
                <div className="lp-greeting">
                  <div>
                    <span className="lp-greeting-sub">Good morning</span>
                    <span className="lp-greeting-name">Hello, Amina</span>
                  </div>
                  <div className="lp-avatar">A</div>
                </div>
                <div className="lp-balance-card">
                  <span className="lp-balance-label">BANK BALANCE</span>
                  <strong className="lp-balance-amount">KES 50,000</strong>
                  <div className="lp-balance-tiles">
                    <div className="lp-tile"><small>Unallocated</small><b>KES 0</b></div>
                    <div className="lp-tile"><small>Savings</small><b>KES 15,000</b></div>
                    <div className="lp-tile"><small>Owed</small><b>KES 0</b></div>
                  </div>
                </div>
                <div className="lp-cheer">Little by little fills the measure.</div>
                <div className="lp-section-row">
                  <span className="lp-section-title">Needs attention</span>
                  <span className="lp-section-link">See all</span>
                </div>
                <div className="lp-attention-card">
                  <div className="lp-attention-icon lp-icon-alert"><AlertCircle size={14} strokeWidth={2} /></div>
                  <div className="lp-attention-body"><b>School fees</b><small>Due this month</small></div>
                  <strong>5,000</strong>
                </div>
                <div className="lp-attention-card">
                  <div className="lp-attention-icon lp-icon-goal"><GraduationCap size={14} strokeWidth={2} /></div>
                  <div className="lp-attention-body"><b>Emergency fund</b><small>Keep building steadily</small></div>
                  <strong>2,000</strong>
                </div>
                <div className="lp-section-row">
                  <span className="lp-section-title">My envelopes</span>
                  <span className="lp-section-link">Open</span>
                </div>
                <div className="lp-envelope-strip">
                  <div className="lp-env-card" style={{ borderTopColor: '#2563EB' }}>
                    <div className="lp-env-icon" style={{ background: '#EFF6FF', color: '#2563EB' }}><Home size={13} strokeWidth={2} /></div>
                    <strong className="lp-env-amount">15,000</strong>
                  </div>
                  <div className="lp-env-card" style={{ borderTopColor: '#16833B' }}>
                    <div className="lp-env-icon" style={{ background: '#E2F1E6', color: '#16833B' }}><ShoppingCart size={13} strokeWidth={2} /></div>
                    <strong className="lp-env-amount">12,000</strong>
                  </div>
                  <div className="lp-env-card" style={{ borderTopColor: '#D97706' }}>
                    <div className="lp-env-icon" style={{ background: '#FBE8DC', color: '#D97706' }}><Bus size={13} strokeWidth={2} /></div>
                    <strong className="lp-env-amount">8,000</strong>
                  </div>
                </div>
              </div>
              <div className="lp-nav">
                <div className="lp-nav-item lp-nav-active"><Home size={14} strokeWidth={2} /><span>Home</span></div>
                <div className="lp-nav-item"><Layers size={14} strokeWidth={2} /><span>Envelopes</span></div>
                <div className="lp-nav-plus"><Plus size={16} strokeWidth={2.5} /></div>
                <div className="lp-nav-item"><Wallet size={14} strokeWidth={2} /><span>Money</span></div>
                <div className="lp-nav-item"><MoreHorizontal size={14} strokeWidth={2} /><span>More</span></div>
              </div>
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="ld-how" id="how">
          <div className="ld-how-inner">
            <h2 className="ld-section-h2">How it works</h2>
            <div className="ld-steps">
              {[
                { n: '01', title: 'Add your income',              desc: 'Whatever you receive, from wherever it comes.' },
                { n: '02', title: 'Fill your envelopes',          desc: 'Rent, food, school fees, savings. Every shilling gets a place.' },
                { n: '03', title: 'Spend and watch them go down', desc: 'Add a note and the envelope and your total fall together.' },
              ].map(s => (
                <div key={s.n} className="ld-step-card">
                  <span className="ld-step-num">{s.n}</span>
                  <strong className="ld-step-title">{s.title}</strong>
                  <p className="ld-step-desc">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Privacy ── */}
        <section className="ld-privacy" id="privacy">
          <div className="ld-privacy-inner">
            <div className="ld-privacy-left">
              <h2 className="ld-privacy-h2">We never read your M-Pesa, SMS or bank.</h2>
              <p className="ld-privacy-p">
                Envelope names and notes are encrypted on your device.
                Only you can see how your money is split.
              </p>
            </div>
            <div className="ld-trust-grid">
              {['Private by design', 'Envelopes you can tell apart', 'Loans and savings done properly', 'Same data on every device'].map(t => (
                <div key={t} className="ld-trust-card">{t}</div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section className="ld-pricing" id="pricing">
          <div className="ld-pricing-inner">
            <h2 className="ld-pricing-h2">Free to start. Plus is KES 199 a month.</h2>
            <p className="ld-pricing-p">14-day free trial. Export and delete your data any time.</p>
            <button className="ld-btn-primary" onClick={() => navigate('/welcome')}>Get started free</button>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="ld-footer">
          <div className="ld-footer-inner">
            <span>A Skydevs Africa product</span>
            <nav aria-label="Footer links">
              <a href="/privacy">Privacy policy</a>
              <span aria-hidden="true">·</span>
              <a href="/terms">Terms</a>
              <span aria-hidden="true">·</span>
              <a href="/contact">Contact</a>
            </nav>
          </div>
        </footer>

      </div>
    </div>
  )
}
