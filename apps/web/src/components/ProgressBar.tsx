interface Props {
  value: number   // 0to100
  color: string
  low?: boolean   // turns amber
  label?: string
}

export function ProgressBar({ value, color, low, label = 'Progress' }: Props) {
  const fill = low ? 'var(--color-warning)' : color
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{
        height: 8,
        background: 'var(--color-border)',
        borderRadius: 6,
        overflow: 'hidden',
        margin: '8px 0 4px',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${Math.min(100, value)}%`,
          background: fill,
          borderRadius: 6,
          transition: 'width var(--dur-normal) var(--ease)',
        }}
      />
    </div>
  )
}
