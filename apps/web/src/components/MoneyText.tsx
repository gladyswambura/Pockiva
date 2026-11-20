import { useEffect, useRef, useState } from 'react'
import { formatMoney } from '@/lib/money'
import { useStore } from '@/store'

interface Props {
  cents: number
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  color?: string
  className?: string
}

const sizeMap = {
  sm:  '14px', md: '16px', lg: '20px', xl: '28px', '2xl': '36px',
}

export function MoneyText({ cents, size = 'md', color, className }: Props) {
  const currency = useStore(s => s.currency)
  const [display, setDisplay] = useState(cents)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const start = display
    const end = cents
    const diff = end - start
    if (diff === 0) return
    const duration = 250
    const startTime = performance.now()

    const animate = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setDisplay(Math.round(start + diff * eased))
      if (progress < 1) rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [cents]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <span
      className={`money ${className ?? ''}`}
      style={{ fontSize: sizeMap[size], fontWeight: 700, color }}
      aria-label={formatMoney(cents, currency)}
    >
      {formatMoney(display, currency)}
    </span>
  )
}
