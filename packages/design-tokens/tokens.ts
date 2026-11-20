/** Pockiva design tokens — TypeScript export.
 *  Use CSS variables in components; use these constants in JS logic only.
 */

export const colors = {
  primary:    "#0B2650",
  primary2:   "#12356B",
  accent:     "#C79A45",
  bg:         "#F4F6FA",
  surface:    "#FFFFFF",
  text:       "#16213A",
  textMuted:  "#6B7690",
  border:     "#E3E8F0",
  success:    "#2E9E6B",
  warning:    "#E08A1E",
  danger:     "#D64545",
  info:       "#2F6FED",
} as const;

export const colorsDark = {
  primary:    "#5B8DEF",
  primary2:   "#3C6FD1",
  accent:     "#D9AE5C",
  bg:         "#0E1626",
  surface:    "#172238",
  text:       "#EAF0FA",
  textMuted:  "#93A0B8",
  border:     "#26324A",
  success:    "#4CC38A",
  warning:    "#F0A64B",
  danger:     "#E56B6B",
  info:       "#5B8DEF",
} as const;

export const envelopeColors = [
  "#2F6FED", "#5B5BD6", "#7C4DDB", "#D6457F",
  "#E4572E", "#E08A1E", "#7BA428", "#2E9E6B",
  "#0F9FB5", "#8D6E4F", "#5B6B86", "#C79A45",
] as const;

export const space = {
  1: "4px",  2: "8px",  3: "12px",
  4: "16px", 6: "24px", 8: "32px",
} as const;

export const radius = {
  tag:   "12px",
  card:  "16px",
  sheet: "24px",
} as const;

export const duration = {
  fast:   150,
  normal: 250,
} as const;

/** Format KES amount from cents. */
export function formatMoney(cents: number, currency = "KES"): string {
  const amount = cents / 100;
  const formatted = new Intl.NumberFormat("en-KE", {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${currency} ${formatted}`;
}
