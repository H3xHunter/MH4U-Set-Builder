import type { SkillRow } from './skills'

export interface Resistances {
  fire: number
  water: number
  thunder: number
  ice: number
  dragon: number
}
export type Element = keyof Resistances

/**
 * Skill effects on defense and element resistance, as confirmed by Hex from the game.
 * Keyed by skill tree id (the converter keeps the source ids); the real-data test checks ids, names and thresholds.
 * Everything else (Def Lock, Status Res, Blight Res and so on) is deliberately NOT modeled.
 */
export const DEFENSE_TREE_ID = 32 // "Defense"

/** Defense skill: the active tier adds a flat amount (threshold -> delta). Applies at both armor levels. */
export const DEFENSE_BY_THRESHOLD: Readonly<Record<number, number>> = {
  [-20]: -20,
  [-15]: -15,
  [-10]: -10,
  10: 10,
  15: 15,
  20: 20,
  25: 25,
}

export const RESISTANCE_TREES: Readonly<Record<Element, { id: number; name: string }>> = {
  fire: { id: 85, name: 'Fire Res' },
  water: { id: 86, name: 'Water Res' },
  thunder: { id: 87, name: 'ThunderRes' },
  ice: { id: 88, name: 'Ice Res' },
  dragon: { id: 89, name: 'Dragon Res' },
}

/**
 * Element Res skills: the active TIER gives the resistance, not the skill points (threshold -> resistance).
 * Points past a skill's top tier add nothing: a skill has a ceiling, so extra points are wasted.
 */
export const RESISTANCE_BY_THRESHOLD: Readonly<Record<number, number>> = {
  10: 15,
  15: 20,
  [-10]: -20,
}

export interface EffectIssue {
  treeId: number
  /** The active tier's threshold that has no entry in the table. */
  threshold: number
}

export interface SkillEffects {
  defense: number
  resistances: Resistances
  issues: EffectIssue[]
}

const ELEMENTS = Object.keys(RESISTANCE_TREES) as Element[]

/** Uses each skill's total tier (armor + charm + decorations + Torso Up), the one the skill bars show. Never throws. */
export function skillEffects(rows: readonly SkillRow[]): SkillEffects {
  const out: SkillEffects = { defense: 0, resistances: { fire: 0, water: 0, thunder: 0, ice: 0, dragon: 0 }, issues: [] }
  for (const row of rows) {
    const tier = row.totalTier
    if (!tier) continue
    const element = ELEMENTS.find((e) => RESISTANCE_TREES[e].id === row.treeId)
    if (row.treeId !== DEFENSE_TREE_ID && !element) continue

    const table = element ? RESISTANCE_BY_THRESHOLD : DEFENSE_BY_THRESHOLD
    const value = table[tier.points]
    if (value === undefined) {
      out.issues.push({ treeId: row.treeId, threshold: tier.points })
      continue
    }
    if (element) out.resistances[element] += value
    else out.defense += value
  }
  return out
}
