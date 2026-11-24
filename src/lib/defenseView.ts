import type { DerivedBuild } from '@/state/derive'
import type { BuildState } from '@/state/build'

export { formatSigned } from './skillBar'

/**
 * Damage taken = 80 / (80 + defense); reduction = 1 - taken. Formula supplied by Hex, NOT verified by us.
 * Returns a fraction, or null when 80 + defense <= 0 (the formula breaks down there).
 */
export function damageReduction(defense: number): number | null {
  const denominator = 80 + defense
  return denominator <= 0 ? null : 1 - 80 / denominator
}

/** Fraction of damage that still gets through: 80 / (80 + defense). Same formula and caveat as damageReduction. */
export function damageTaken(defense: number): number | null {
  const reduction = damageReduction(defense)
  return reduction === null ? null : 1 - reduction
}

export const FORMULA_TEXT = 'Damage taken = 80 / (80 + defense); reduction = 1 - taken'

export const formatPercent = (fraction: number, digits = 1): string => `${(fraction * 100).toFixed(digits)}%`

export const RESISTANCE_KEYS = [
  { key: 'fire', label: 'Fire', name: 'Fire' },
  { key: 'water', label: 'Water', name: 'Water' },
  { key: 'thunder', label: 'Thun.', name: 'Thunder' },
  { key: 'ice', label: 'Ice', name: 'Ice' },
  { key: 'dragon', label: 'Dragon', name: 'Dragon' },
] as const

export interface DefenseView {
  /** Armor defense plus the weapon bonus (counting the bonus is itself unverified, see derive.ts). */
  total: number
  armor: number
  weaponBonus: number
  /** False when nothing is equipped (no armor, no weapon bonus): the UI shows "-". */
  hasAnything: boolean
  /** Pieces that fell back to normal defense because the data has no max defense (only meaningful at max level). */
  fallbackCount: number
  reduction: number | null
  /** 1 - reduction; shown in parentheses next to it. */
  taken: number | null
  /** Armor pieces only: skill-based resistance (Fire Res and so on) is not modeled. */
  resist: { key: (typeof RESISTANCE_KEYS)[number]['key']; label: string; name: string; value: number }[]
}

export function defenseView(derived: DerivedBuild, armorLevel: BuildState['armorLevel']): DefenseView {
  const hasAnything = Object.keys(derived.skillInput.pieces).length > 0 || derived.weaponDefenseBonus !== 0
  return {
    total: derived.totalDefense,
    armor: derived.armorDefense,
    weaponBonus: derived.weaponDefenseBonus,
    hasAnything,
    fallbackCount: armorLevel === 'max' ? derived.maxDefenseFallbackCount : 0,
    reduction: hasAnything ? damageReduction(derived.totalDefense) : null,
    taken: hasAnything ? damageTaken(derived.totalDefense) : null,
    resist: RESISTANCE_KEYS.map((r) => ({ ...r, value: derived.resistances[r.key] })),
  }
}
