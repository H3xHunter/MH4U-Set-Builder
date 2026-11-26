/*
 * Class and sharpness numbers of the damage model. Buff values live in buffRegistry.ts.
 * SOURCE: every number in this file comes from the project owner's in-game knowledge of MH4U (see
 * docs/damage-model.md), NOT from the database. Do not "correct" a value here without the owner.
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

/** The exact `type` strings of weapons.json. A type in neither list is left out of the result. */
export const ELEMENT_TYPES: readonly string[] = ['Fire', 'Water', 'Thunder', 'Ice', 'Dragon']
export const STATUS_TYPES: readonly string[] = ['Poison', 'Paralysis', 'Sleep', 'Blastblight']
