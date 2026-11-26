import type { DamageResult, InstanceResult } from './damage'

/** Index 0..6 = the sharpness colors, red to purple. */
export const SHARPNESS_NAMES = ['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'White', 'Purple'] as const

const MINUS = '−'
const DASH = '–'

/** One decimal everywhere ("377.5"); a value that is not a finite number is an en dash. */
export function formatDecimal(n: number): string {
  if (!Number.isFinite(n)) return DASH
  const s = n.toFixed(1)
  return s === '-0.0' ? '0.0' : s
}

/** One decimal with a sign: "+30.0", "−12.5", "0.0" (real minus sign). */
export function formatSignedDecimal(n: number): string {
  const s = formatDecimal(n)
  if (s === DASH || s === '0.0') return s
  return n > 0 ? `+${s}` : `${MINUS}${s.slice(1)}`
}

/** A multiplier with its exact digits, at least two decimals and at most four: "1.075", "1.32", "0.95", "1.00". */
export function formatFactor(n: number): string {
  if (!Number.isFinite(n)) return DASH
  const s = n.toFixed(4).replace(/0+$/, '')
  const decimals = s.length - s.indexOf('.') - 1
  return decimals >= 2 ? s : n.toFixed(2)
}

export const instanceLabel = (i: Pick<InstanceResult, 'kind' | 'type'>): string =>
  `${i.kind === 'status' ? 'Effective status' : 'Effective element'}: ${i.type}`

/** Mobile summary: the true EFR with one decimal, or an en dash when there is no result. */
export const efrSummary = (r: DamageResult | null): string => (r?.ok ? formatDecimal(r.efrTrue) : DASH)

/** Mobile summary: each instance's value ("Status " prefix for a status), joined by " / "; an en dash when there is none. */
export function efeSummary(r: DamageResult | null): string {
  if (!r?.ok || r.instances.length === 0) return DASH
  return r.instances.map((i) => (i.kind === 'status' ? `Status ${formatDecimal(i.effectiveShown)}` : formatDecimal(i.effectiveShown))).join(' / ')
}
