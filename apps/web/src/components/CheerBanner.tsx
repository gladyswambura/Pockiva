import { useState, useCallback, useMemo } from 'react'
import { Sparkles } from 'lucide-react'
import { useStore } from '@/store'
import { useT } from '@/i18n/useT'

export function CheerBanner({ override }: { override?: string } = {}) {
  const faithContent = useStore(s => s.faithContent)
  const t = useT()

  const pool = useMemo(
    () => faithContent ? [...t.cheer, ...t.cheerFaith] : [...t.cheer],
    [faithContent, t.cheer, t.cheerFaith]
  )

  const [rawIdx, setIdx] = useState(0)
  const idx = rawIdx % pool.length

  const next = useCallback(() => {
    setIdx(i => (i + 1) % pool.length)
  }, [pool.length])

  const message = override ?? pool[idx]

  return (
    <div className="banner" style={{
      display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between',
      marginTop: 16, marginBottom: 4,
    }}>
      <span style={{ flex: 1 }}>{message}</span>
      {!override && (
        <button
          onClick={next}
          aria-label="Next encouragement"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--cheer-accent)', padding: 4, flexShrink: 0,
          }}
        >
          <Sparkles size={18} />
        </button>
      )}
    </div>
  )
}