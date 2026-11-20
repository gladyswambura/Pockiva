/**
 * All amounts are integer cents. KES 750.50 = 75050. Never floats.
 */

export function formatMoney(cents: number, currency = 'KES'): string {
  const amount = cents / 100
  const hasCents = cents % 100 !== 0
  return `${currency}\u00A0${new Intl.NumberFormat('en-KE', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount)}`
}

/** Parse a user-typed string like "1,200.50" → 120050 cents */
export function parseCents(raw: string): number {
  const n = parseFloat(raw.replace(/,/g, ''))
  if (!isFinite(n) || n < 0) return 0
  return Math.round(n * 100)
}

/** Display a cents value as a plain number string for inputs */
export function centsToInput(cents: number): string {
  if (cents === 0) return ''
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)
}
