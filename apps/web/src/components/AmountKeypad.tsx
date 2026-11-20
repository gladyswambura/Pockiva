import { useState } from 'react'

// Approximate KES→USD rate. In production this would come from an API.
const KES_TO_USD = 1 / 129

function fmtUsd(kes: number) {
  const usd = (kes / 100) * KES_TO_USD
  return usd.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

interface Props {
  onConfirm: (cents: number) => void
  maxCents?: number
  label?: string
  confirmLabel?: string
  onSecondary?: (cents: number) => void
  secondaryLabel?: string
}

export function AmountKeypad({ onConfirm, maxCents, label, confirmLabel, onSecondary, secondaryLabel }: Props) {
  const [raw, setRaw] = useState('')

  const cents = Math.round(parseFloat(raw || '0') * 100)
  const display = raw ? `KES ${raw}` : `KES 0`
  const isOver = maxCents !== undefined && cents > maxCents

  const press = (key: string) => {
    if (key === '⌫') { setRaw(r => r.slice(0, -1)); return }
    if (key === '.' && raw.includes('.')) return
    if (raw.split('.')[1]?.length >= 2) return
    if (raw === '0' && key !== '.') { setRaw(key); return }
    setRaw(r => r + key)
  }

  const keys = ['1','2','3','4','5','6','7','8','9','.','0','⌫']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {label && <div style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 600 }}>{label}</div>}

      <div style={{ textAlign: 'center', padding: 'var(--space-3) 0 0' }}>
        <div
          role="status" aria-live="polite" aria-atomic="true"
          style={{
            fontSize: 36, fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
            color: isOver ? 'var(--color-danger)' : 'var(--color-text)',
          }}
        >
          {display}
        </div>
        {cents > 0 && (
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
            ≈ {fmtUsd(cents)}
          </div>
        )}
        {isOver && maxCents !== undefined && (
          <div style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 4 }}>
            Only KES {(maxCents / 100).toLocaleString()} available
          </div>
        )}
      </div>

      <div role="group" aria-label="Amount keypad" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
        {keys.map(k => (
          <button
            key={k}
            onClick={() => press(k)}
            aria-label={k === '⌫' ? 'Backspace' : k}
            style={{
              height: 56, fontSize: k === '⌫' ? 20 : 22, fontWeight: 600,
              background: 'var(--color-bg)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-tag)', cursor: 'pointer',
              color: 'var(--color-text)',
              transition: 'background var(--dur-fast)',
              minWidth: 48,
            }}
          >
            {k}
          </button>
        ))}
      </div>

      <button
        onClick={() => { if (cents > 0 && !isOver) onConfirm(cents) }}
        disabled={cents <= 0 || isOver}
        style={{
          height: 52, background: 'var(--color-primary)', color: 'var(--color-on-primary)',
          border: 'none', borderRadius: 'var(--radius-card)', fontSize: 16,
          fontWeight: 700, cursor: cents > 0 && !isOver ? 'pointer' : 'not-allowed',
          opacity: cents > 0 && !isOver ? 1 : 0.5,
          transition: 'opacity var(--dur-fast)',
        }}
      >
        {confirmLabel ?? 'Confirm'}{cents > 0 ? ` · KES ${(cents / 100).toLocaleString()}` : ''}
      </button>

      {onSecondary && secondaryLabel && (
        <button
          onClick={() => { if (cents > 0 && !isOver) onSecondary(cents) }}
          disabled={cents <= 0 || isOver}
          style={{
            height: 48, background: 'var(--color-accent)', color: 'var(--color-accent-ink)',
            border: 'none', borderRadius: 'var(--radius-card)', fontSize: 14,
            fontWeight: 700, cursor: cents > 0 && !isOver ? 'pointer' : 'not-allowed',
            opacity: cents > 0 && !isOver ? 1 : 0.5,
            transition: 'opacity var(--dur-fast)',
          }}
        >
          {secondaryLabel}
        </button>
      )}
    </div>
  )
}
