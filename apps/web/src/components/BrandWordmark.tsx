interface Props {
  className?: string
  light?: boolean
}

export function BrandWordmark({ className = '', light = false }: Props) {
  return (
    <span className={`brand-wordmark${light ? ' brand-wordmark-light' : ''} ${className}`}>
      <span className="brand-wordmark-base">Pockiva</span>
    </span>
  )
}