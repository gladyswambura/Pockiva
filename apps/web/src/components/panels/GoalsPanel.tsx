import { useEffect, useState } from 'react'
import { EmptyState } from '@/components/Shared'
import { useStore } from '@/store'
import { showToast } from '@/components/Toast'
import { apiFetch, newKey, getToken } from '@/lib/api'
import { safeDecrypt } from '@/lib/crypto'
import { Target, Check } from 'lucide-react'

interface GoalState {
  id: string
  text_enc: string | null
  section: string | null
  linked_account_id: string | null
  done: boolean
  sort_order: number
  created_at: string
}

interface GoalView extends GoalState {
  textPlain: string
}

export function GoalsPanel({ onNew }: { onNew?: () => void }) {
  const { dek, _hasHydrated } = useStore()
  const [goals, setGoals] = useState<GoalView[]>([])
  const [loading, setLoading] = useState(true)

  const token = getToken()

  const refresh = async () => {
    const raw = await apiFetch<GoalState[]>('/goals')
    const decoded: GoalView[] = await Promise.all(raw.map(async g => ({
      ...g,
      textPlain: g.text_enc ? await safeDecrypt(g.text_enc, dek) : (g.section ?? 'Goal'),
    })))
    setGoals(decoded)
    setLoading(false)
  }

  useEffect(() => {
    if (!_hasHydrated || !token) return
    refresh().catch(() => setLoading(false))
  }, [token, _hasHydrated])

  const toggleDone = async (goal: GoalView) => {
    try {
      await apiFetch(`/goals/${goal.id}`, { method: 'PATCH', body: { done: !goal.done }, idempotencyKey: newKey(), offlineFallback: true })
      await refresh()
    } catch { showToast('Could not update goal.') }
  }

  const deleteGoal = async (goal: GoalView) => {
    try {
      await apiFetch(`/goals/${goal.id}`, { method: 'DELETE', idempotencyKey: newKey() })
      await refresh()
      showToast('Goal removed.')
    } catch { showToast('Could not remove goal.') }
  }

  const remaining = goals.filter(g => !g.done).length

  return (
    <div className="screen-content">
      {loading ? (
        <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
          Loading goals…
        </div>
      ) : goals.length === 0 ? (
        <EmptyState
          icon={<Target size={40} />}
          message="Add the dreams you are saving for."
          action={
            <button
              onClick={onNew}
              style={{ padding: '10px 20px', background: 'var(--color-primary)', color: 'var(--color-on-primary)', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}
            >
              Add your first goal
            </button>
          }
        />
      ) : (
        <>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 4 }}>
            {remaining} of {goals.length} remaining
          </div>
          <div className="journal-entries">
            {goals.map(g => (
              <article key={g.id} className="goal-card" style={{ opacity: g.done ? .6 : 1 }}>
                <div className="goal-card-head">
                  <button
                    onClick={() => toggleDone(g)}
                    aria-label={g.done ? 'Mark not done' : 'Mark done'}
                    style={{
                      width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                      border: `2px solid ${g.done ? 'var(--color-success)' : 'var(--color-border)'}`,
                      background: g.done ? 'var(--color-success)' : 'var(--color-surface)',
                      color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center',
                    }}
                  >
                    {g.done && <Check size={18} />}
                  </button>
                  <div className="goal-card-info">
                    <div className="goal-card-name" style={{ textDecoration: g.done ? 'line-through' : 'none', color: g.done ? 'var(--color-text-muted)' : 'var(--color-text)' }}>
                      {g.textPlain}
                    </div>
                    {g.section && <div className="goal-card-target">{g.section}</div>}
                  </div>
                  <button
                    onClick={() => deleteGoal(g)}
                    aria-label="Delete goal"
                    style={{
                      width: 44, height: 44, background: 'none', border: 'none',
                      cursor: 'pointer', color: 'var(--color-text-muted)',
                      display: 'grid', placeItems: 'center', flexShrink: 0,
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: 20 }}>delete</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  )
}