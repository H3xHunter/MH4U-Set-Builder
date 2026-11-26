/*
 * Numbers of the damage model.
 * SOURCE: every number in this file comes from the project owner's in-game knowledge of MH4U (see
 * docs/damage-model.md), NOT from the database. Do not "correct" a value here without the owner.
 * The only data-derived check is the test that every tree id and tier threshold below exists in skills.json.
 */

/** Displayed attack = true raw * multiplier, keyed by the exact `class` strings of weapons.json. */
export const CLASS_MULTIPLIERS: Readonly<Record<string, number>> = {
  'Switch Axe': 5.4,
  Hammer: 5.2,
  'Hunting Horn': 5.2,
  'Great Sword': 4.8,
  'Charge Blade': 3.6,
  'Long Sword': 3.3,
  'Insect Glaive': 3.1,
  Lance: 2.3,
  Gunlance: 2.3,
  'Heavy Bowgun': 1.5,
  'Sword and Shield': 1.4,
  'Dual Blades': 1.4,
  'Light Bowgun': 1.3,
  Bow: 1.2,
}

/** Index 0..6 = red, orange, yellow, green, blue, white, purple. */
export const SHARPNESS_RAW: readonly number[] = [0.5, 0.75, 1.0, 1.05, 1.2, 1.32, 1.45]
export const SHARPNESS_ELEMENT: readonly number[] = [0.25, 0.5, 0.75, 1.0, 1.0625, 1.125, 1.2]

/** Crit damage is always x1.25; affinity scales how much of it applies. */
export const CRIT_BONUS = 0.25

/** tree id -> (tier threshold -> value). The tier is picked from the tree's total points like Defense is. */
export type TierTable = Readonly<Record<number, number>>
export type TreeTiers = Readonly<Record<number, TierTable>>

/** Raw flat group G1 (best positive wins, a negative tier always applies). Edgemaster's Honed Blade is +20. */
export const RAW_FLAT_G1: TreeTiers = {
  31: { [-20]: -20, [-15]: -15, [-10]: -10, 10: 10, 15: 15, 20: 20, 25: 25 }, // Attack
  2: { 10: 20 }, // Edgemaster
}
export const POWERCHARM_FLAT = 6
export const POWERTALON_FLAT = 9
/** Challenger (Spirit), only while a monster is raged. */
export const CHALLENGER_RAW: TreeTiers = { 26: { 10: 10, 15: 25 } }
export const CHALLENGER_AFFINITY: TreeTiers = { 26: { 10: 10, 15: 20 } }

/** Affinity group in percentage points: Expert (Critical Eye / Critical God) and Brutality's Ruthlessness. */
export const AFFINITY_GROUP: TreeTiers = {
  37: { [-20]: -20, [-15]: -15, [-10]: -10, 10: 10, 15: 15, 20: 20, 30: 30 },
  10: { 10: 15 },
}

/** Insect Glaive kinsect buffs, a raw percent group. */
export const KINSECT_TRIPLE_PERCENT = 25
export const KINSECT_RED_WHITE_PERCENT = 20

/** Hunting Horn songs (encore always assumed). Attack Up S and L do not stack: the best one wins. */
export const SONG_ATTACK_S_PERCENT = 15
export const SONG_ATTACK_L_PERCENT = 20
export const SONG_AFFINITY_POINTS = 20
export const SONG_ELEMENT_PERCENT = 20

/** Element percent group (best positive wins, a negative tier divides), in percent. */
export const ELEMENT_PERCENT_GROUP: TreeTiers = {
  84: { [-10]: -10, 10: 10 }, // Elemental
  14: { 10: 10 }, // Amplify
  140: { 10: 10 }, // Arcana
}

/** (Ele) Atk tree id -> element type string of the weapon data. Names checked against skills.json by a test. */
export const ELEMENT_ATK_TREES: Readonly<Record<number, string>> = {
  79: 'Fire',
  80: 'Water',
  81: 'Thunder',
  82: 'Ice',
  83: 'Dragon',
}
export interface ElementAtkTier {
  mult: number
  flat: number
}
/** Positive tiers multiply and add. The -10 tier is the exact inverse of the 10 tier (divide, subtract); it reuses its numbers. */
export const ELEMENT_ATK_TIERS: Readonly<Record<number, ElementAtkTier>> = {
  [-10]: { mult: 1.05, flat: 40 },
  10: { mult: 1.05, flat: 40 },
  15: { mult: 1.1, flat: 60 },
  20: { mult: 1.15, flat: 90 },
}

/** Skills that act as switches: the tier at this threshold must be active. */
export const SHARPNESS_PLUS_TREES: Readonly<Record<number, number>> = { 19: 10, 2: 10 } // Handicraft, Edgemaster
export const AWAKEN_TREES: Readonly<Record<number, number>> = { 17: 10, 140: 10 } // Awaken, Enlightened Blade
export const WEAKNESS_EXPLOIT_TREES: Readonly<Record<number, number>> = { 29: 10, 10: 10 } // Tenderizer, Brutality

/** Every tree id and threshold used above, for the data-consistency test. */
export function tableThresholds(): Map<number, Set<number>> {
  const out = new Map<number, Set<number>>()
  const add = (id: number, t: number) => out.set(id, (out.get(id) ?? new Set<number>()).add(t))
  for (const g of [RAW_FLAT_G1, CHALLENGER_RAW, CHALLENGER_AFFINITY, AFFINITY_GROUP, ELEMENT_PERCENT_GROUP]) {
    for (const [id, tiers] of Object.entries(g)) for (const t of Object.keys(tiers)) add(Number(id), Number(t))
  }
  for (const id of Object.keys(ELEMENT_ATK_TREES)) for (const t of Object.keys(ELEMENT_ATK_TIERS)) add(Number(id), Number(t))
  for (const g of [SHARPNESS_PLUS_TREES, AWAKEN_TREES, WEAKNESS_EXPLOIT_TREES]) for (const [id, t] of Object.entries(g)) add(Number(id), t)
  return out
}
