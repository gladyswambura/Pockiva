type TagVariant = 'funded' | 'needs' | 'low' | 'empty' | 'paid' | 'cleared' | 'debt' | 'goal' | 'locked'

interface Props {
  variant: TagVariant
  label: string
}

const styles: Record<TagVariant, { bg: string; color: string }> = {
  funded:  { bg: 'var(--color-success-soft)', color: 'var(--color-success)' },
  needs:   { bg: 'var(--color-danger-soft)', color: 'var(--color-danger)' },
  low:     { bg: 'var(--color-accent-soft)', color: 'var(--color-warning)' },
  empty:   { bg: 'var(--color-danger-soft)', color: 'var(--color-danger)' },
  paid:    { bg: 'var(--color-success-soft)', color: 'var(--color-success)' },
  cleared: { bg: 'var(--color-success-soft)', color: 'var(--color-success)' },
  debt:    { bg: 'var(--color-danger-soft)', color: 'var(--color-danger)' },
  goal:    { bg: 'var(--color-info-soft)', color: 'var(--color-info)' },
  locked:  { bg: 'var(--color-accent-soft)', color: 'var(--color-text)' },
}

export function Tag({ variant, label }: Props) {
  const s = styles[variant]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 11,
        fontWeight: 700,
        padding: '3px 8px',
        borderRadius: 'var(--radius-tag)',
        background: s.bg,
        color: s.color,
        whiteSpace: 'nowrap',
        marginTop: 4,
      }}
    >
      {label}
    </span>
  )
}
