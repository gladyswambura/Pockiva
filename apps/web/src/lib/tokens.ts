/** Design tokens re-exported for use inside src/. Values must stay in sync with packages/design-tokens/tokens.ts */

export const colors = {
  primary:   '#0B2249',
  primary2:  '#1D63DC',
  accent:    '#C6923A',
  bg:        '#F3F5F8',
  surface:   '#FFFFFF',
  text:      '#16213A',
  textMuted: '#6B7690',
  border:    '#E5E9F0',
  success:   '#1E7E34',
  warning:   '#B45309',
  danger:    '#B92B27',
  info:      '#0369A1',
} as const

export const envelopeColors: string[] = [
  '#2563EB', '#0D9488', '#D97706', '#16A34A',
  '#7C3AED', '#DB2777', '#4F46E5', '#0284C7',
  '#DC2626', '#059669', '#C6923A', '#1D63DC',
]
