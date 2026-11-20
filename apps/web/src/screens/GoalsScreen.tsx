import { useT } from '@/i18n/useT'
import { GoalsPanel } from '@/components/panels/GoalsPanel'
import { BottomSheet } from '@/components/BottomSheet'
import { useStore } from '@/store'
import { showToast } from '@/components/Toast'
import { apiFetch, newKey } from '@/lib/api'
import { safeEncrypt } from '@/lib/crypto'
import { useState } from 'react'

export function GoalsScreen() {
  const t = useT()
  const { dek } = useStore()
  const [showNew, setShowNew] = useState(false)

  return (
    <div className="screen-page goals-screen">
      <header className="screen-heading">
        <div>
          <h1>{t.goals.title}</h1>
          <p>{t.goals.empty}</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)', border: 'none', borderRadius: 12, padding: '10px 14px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
        >
          + Add goal
        </button>
      </header>
      <GoalsPanel onNew={() => setShowNew(true)} />
      <NewGoalSheet open={showNew} onClose={() => setShowNew(false)} dek={dek} />
    </div>
  )
}

function NewGoalSheet({ open, onClose, dek }: { open: boolean; onClose: () => void; dek: CryptoKey | null }) {
  const t = useT()
  const [text, setText] = useState('')
  const [section, setSection] = useState('')
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!text.trim()) { setError(t.errors.required); return }
    try {
      const textEnc = await safeEncrypt(text.trim(), dek)
      await apiFetch('/goals', {
        method: 'POST',
        body: {
          text_enc: textEnc || null,
          section: section.trim() || null,
          sort_order: 0,
        },
        idempotencyKey: newKey(),
      })
      showToast('Goal added.')
      setText(''); setSection(''); setError('')
      onClose()
    } catch (e: unknown) {
      const err = e as { detail?: { message?: string } }
      setError(err?.detail?.message ?? 'Could not add goal.')
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Add a goal">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="field">
          <label className="field-label">Goal</label>
          <input value={text} onChange={e => setText(e.target.value)} placeholder="e.g. Start a side hustle" autoFocus className="field-input" />
        </div>
        <div className="field">
          <label className="field-label">Section (optional)</label>
          <input value={section} onChange={e => setSection(e.target.value)} placeholder="e.g. Income, Family, Health" className="field-input" />
        </div>
        {error && <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p>}
        <button onClick={handleSave} style={{ padding: '14px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 16 }}>
          Add goal
        </button>
      </div>
    </BottomSheet>
  )
}