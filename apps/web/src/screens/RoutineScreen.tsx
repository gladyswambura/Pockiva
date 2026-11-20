import { useEffect, useState } from 'react'
import { useT } from '@/i18n/useT'
import { EmptyState } from '@/components/Shared'
import { useStore } from '@/store'
import { showToast } from '@/components/Toast'
import { apiFetch, newKey, getToken } from '@/lib/api'
import { safeDecrypt } from '@/lib/crypto'
import { ClipboardList, Check } from 'lucide-react'

interface RoutineStep {
  id: string
  label_enc: string | null
  sort_order: number
  done_this_month: boolean
}

interface RoutineStepView extends RoutineStep {
  labelPlain: string
}

export function RoutineScreen() {
  const t = useT()
  const { dek, _hasHydrated } = useStore()
  const [steps, setSteps] = useState<RoutineStepView[]>([])
  const [loading, setLoading] = useState(true)

  const token = getToken()

  const refresh = async () => {
    const raw = await apiFetch<RoutineStep[]>('/routine')
    const decoded: RoutineStepView[] = await Promise.all(raw.map(async s => ({
      ...s,
      labelPlain: s.label_enc ? await safeDecrypt(s.label_enc, dek) : 'Step',
    })))
    setSteps(decoded)
    setLoading(false)
  }

  useEffect(() => {
    if (!_hasHydrated || !token) return
    refresh().catch(() => setLoading(false))
  }, [token, _hasHydrated])

  const toggleStep = async (step: RoutineStepView) => {
    const next = steps.map(s => s.id === step.id ? { ...s, done_this_month: !s.done_this_month } : s)
    setSteps(next)
    try {
      await apiFetch('/routine', {
        method: 'PATCH',
        body: { steps: next.map(s => ({ id: s.id, done_this_month: s.done_this_month })) },
        idempotencyKey: newKey(),
      })
    } catch {
      setSteps(steps)
      showToast('Could not save. Check your connection.')
    }
  }

  const done = steps.filter(s => s.done_this_month).length
  const progress = steps.length > 0 ? (done / steps.length) * 100 : 0

  return (
    <div className="screen-page routine-screen">
      <header className="screen-heading">
        <div>
          <h1>{t.routine.title}</h1>
          <p>Your monthly money routine. Tick each step as you do it.</p>
        </div>
      </header>

      <div className="screen-content">
        {loading ? (
          <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
            Loading routine…
          </div>
        ) : steps.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={40} />}
            message="Your routine will appear once you add income."
          />
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                {done} of {steps.length} done this month
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-success)' }}>
                {progress.toFixed(0)}%
              </span>
            </div>
            <div className="progress-bar" style={{ marginBottom: 8 }}>
              <div className="progress-fill" style={{ width: `${progress}%`, background: 'var(--color-success)' }} />
            </div>

            <div className="journal-entries">
              {steps.map(step => (
                <article key={step.id} className="routine-card" style={{ opacity: step.done_this_month ? .65 : 1 }}>
                  <div className="routine-card-icon">
                    {step.done_this_month ? <Check size={20} /> : <ClipboardList size={20} />}
                  </div>
                  <div className="routine-card-info">
                    <div className="routine-card-name" style={{ textDecoration: step.done_this_month ? 'line-through' : 'none', color: step.done_this_month ? 'var(--color-text-muted)' : 'var(--color-text)' }}>
                      {step.labelPlain}
                    </div>
                    <div className="routine-card-meta">
                      {step.done_this_month ? 'Done' : 'Pending'}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleStep(step)}
                    aria-label={step.done_this_month ? 'Mark pending' : 'Mark done'}
                    style={{
                      width: 44, height: 44, borderRadius: 50, flexShrink: 0,
                      border: `2px solid ${step.done_this_month ? 'var(--color-success)' : 'var(--color-border)'}`,
                      background: step.done_this_month ? 'var(--color-success)' : 'var(--color-surface)',
                      color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center',
                    }}
                  >
                    {step.done_this_month && <Check size={18} />}
                  </button>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}