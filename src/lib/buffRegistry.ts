/*
 * Every damage buff as a data entry. Adding a buff means adding one entry here; the formula (damage.ts) never changes.
 * SOURCE: every number comes from the project owner's in-game knowledge of MH4U (docs/damage-model.md), not from the
 * database. Do not "correct" a value without the owner.
 *
 * IDS ARE A STORAGE FORMAT: toggle states will be saved by buff id. NEVER rename or reuse an id; to retire a buff,
 * delete the entry and leave its id unused. Ids match /^[a-z0-9:_.-]{1,64}$/.
 */

export const BUFF_ID_PATTERN = /^[a-z0-9:_.-]{1,64}$/

export type BuffSource = 'skill' | 'item' | 'song' | 'kinsect'
/** Order the groups are listed in. */
export const BUFF_SOURCES: readonly BuffSource[] = ['skill', 'item', 'song', 'kinsect']

/**
 * How an effect combines, and where it sits in the formula (damage.ts uses them in this order):
 *   rawPercent       percent, multiplies true raw
 *   rawFlat          adds to raw (after rawPercent)
 *   songRaw          percent, final raw multiplier
 *   affinityAdd      adds affinity points
 *   elementPercent   percent, multiplies an element value
 *   elementMult      percent, multiplies an element value (an (Ele) Atk multiplier)
 *   elementFlat      adds to an element value (after the multipliers)
 *   songElement      percent, final element multiplier
 *   statusPercent    percent, multiplies a status value (the only thing that touches it)
 *   awaken, sharpnessPlus, weaknessExploit   flags, no value
 * 'add' types sum their groups; 'mult' types multiply them. To add a type: add it here and use it in damage.ts.
 */
export const EFFECT_TYPES = {
  rawPercent: 'mult',
  rawFlat: 'add',
  songRaw: 'mult',
  affinityAdd: 'add',
  elementPercent: 'mult',
  elementMult: 'mult',
  elementFlat: 'add',
  songElement: 'mult',
  statusPercent: 'mult',
  awaken: 'flag',
  sharpnessPlus: 'flag',
  weaknessExploit: 'flag',
} as const
export type EffectType = keyof typeof EFFECT_TYPES

/** Value per POSITIVE tier threshold. A negative tier -n uses the value of tier n, inverted (negated or divided). */
export type TierValues = Readonly<Record<number, number>>

export interface Effect {
  type: EffectType
  /**
   * Inside one group (per effect type) the best positive value wins and the worst negative one still applies on top.
   * Percent values: +12.5 means x1.125; the inverse of a tier divides by that factor. Flags carry no value.
   */
  group: string
  /** A number for items, songs and kinsect; per-tier values for a skill. */
  value?: number | TierValues
  /** Element and status effects that apply to one element type only (an (Ele) Atk skill). */
  element?: string
  /** The effect applies only while all of these buffs are active (the kinsect combinations). */
  needs?: readonly string[]
}

export interface Buff {
  id: string
  label: string
  source: BuffSource
  /** The tree's total points must reach one of these tiers (negative tiers included) for the buff to exist. */
  skill?: { tree: number; tiers: readonly number[] }
  /** Weapon classes the buff exists for. Absent: every class. */
  classes?: readonly string[]
  /** Absent: always on whenever available. */
  toggle?: { default: boolean; condition?: string }
  effects: readonly Effect[]
}

const HORN = ['Hunting Horn'] as const
const GLAIVE = ['Insect Glaive'] as const

const eleAtk = (id: string, tree: number, element: string): Buff => ({
  id: `skill:${id}`,
  label: `${element} Atk`,
  source: 'skill',
  skill: { tree, tiers: [-10, 10, 15, 20] },
  effects: [
    { type: 'elementMult', group: `ele-atk:${element}`, element, value: { 10: 5, 15: 10, 20: 15 } },
    { type: 'elementFlat', group: `ele-atk:${element}`, element, value: { 10: 40, 15: 60, 20: 90 } },
  ],
})

export const BUFFS: readonly Buff[] = [
  // Skills: raw
  {
    id: 'skill:attack',
    label: 'Attack',
    source: 'skill',
    skill: { tree: 31, tiers: [-20, -15, -10, 10, 15, 20, 25] },
    effects: [{ type: 'rawFlat', group: 'raw-flat:attack', value: { 10: 10, 15: 15, 20: 20, 25: 25 } }],
  },
  {
    id: 'skill:edgemaster',
    label: 'Edgemaster (Honed Blade)',
    source: 'skill',
    skill: { tree: 2, tiers: [10] },
    effects: [
      { type: 'rawFlat', group: 'raw-flat:attack', value: { 10: 20 } },
      { type: 'sharpnessPlus', group: 'sharpness-plus' },
    ],
  },
  {
    id: 'skill:handicraft',
    label: 'Handicraft (Sharpness +1)',
    source: 'skill',
    skill: { tree: 19, tiers: [10] },
    effects: [{ type: 'sharpnessPlus', group: 'sharpness-plus' }],
  },
  {
    id: 'skill:challenger',
    label: 'Challenger',
    source: 'skill',
    skill: { tree: 26, tiers: [10, 15] },
    toggle: { default: true, condition: 'Raged monster' },
    effects: [
      { type: 'rawFlat', group: 'raw-flat:challenger', value: { 10: 10, 15: 25 } },
      { type: 'affinityAdd', group: 'aff:challenger', value: { 10: 10, 15: 20 } },
    ],
  },
  // Skills: affinity and weakness
  {
    id: 'skill:expert',
    label: 'Critical Eye (Expert)',
    source: 'skill',
    skill: { tree: 37, tiers: [-20, -15, -10, 10, 15, 20, 30] },
    effects: [{ type: 'affinityAdd', group: 'aff:crit', value: { 10: 10, 15: 15, 20: 20, 30: 30 } }],
  },
  {
    id: 'skill:brutality',
    label: 'Ruthlessness (Brutality)',
    source: 'skill',
    skill: { tree: 10, tiers: [10] },
    effects: [
      { type: 'affinityAdd', group: 'aff:crit', value: { 10: 15 } },
      { type: 'weaknessExploit', group: 'weakness-exploit' },
    ],
  },
  {
    id: 'skill:tenderizer',
    label: 'Weakness Exploit (Tenderizer)',
    source: 'skill',
    skill: { tree: 29, tiers: [10] },
    effects: [{ type: 'weaknessExploit', group: 'weakness-exploit' }],
  },
  // Skills: element and status
  {
    id: 'skill:elemental',
    label: 'Element Atk (Elemental)',
    source: 'skill',
    skill: { tree: 84, tiers: [-10, 10] },
    effects: [{ type: 'elementPercent', group: 'ele-pct', value: { 10: 10 } }],
  },
  {
    id: 'skill:amplify',
    label: 'Elementality (Amplify)',
    source: 'skill',
    skill: { tree: 14, tiers: [10] },
    effects: [{ type: 'elementPercent', group: 'ele-pct', value: { 10: 10 } }],
  },
  {
    id: 'skill:arcana',
    label: 'Enlightened Blade (Arcana)',
    source: 'skill',
    skill: { tree: 140, tiers: [10] },
    effects: [
      { type: 'elementPercent', group: 'ele-pct', value: { 10: 10 } },
      { type: 'statusPercent', group: 'status-pct', value: { 10: 10 } },
      { type: 'awaken', group: 'awaken' },
    ],
  },
  {
    id: 'skill:awaken',
    label: 'Awaken',
    source: 'skill',
    skill: { tree: 17, tiers: [10] },
    effects: [{ type: 'awaken', group: 'awaken' }],
  },
  {
    id: 'skill:status',
    label: 'Status Atk (Status)',
    source: 'skill',
    skill: { tree: 48, tiers: [-10, 10, 15] },
    effects: [{ type: 'statusPercent', group: 'status-pct', value: { 10: 12.5, 15: 25 } }],
  },
  eleAtk('fire-atk', 79, 'Fire'),
  eleAtk('water-atk', 80, 'Water'),
  eleAtk('thunder-atk', 81, 'Thunder'),
  eleAtk('ice-atk', 82, 'Ice'),
  eleAtk('dragon-atk', 83, 'Dragon'),

  // Items
  {
    id: 'item:powercharm',
    label: 'Powercharm',
    source: 'item',
    toggle: { default: false },
    effects: [{ type: 'rawFlat', group: 'raw-flat:powercharm', value: 6 }],
  },
  {
    id: 'item:powertalon',
    label: 'Powertalon',
    source: 'item',
    toggle: { default: false },
    effects: [{ type: 'rawFlat', group: 'raw-flat:powertalon', value: 9 }],
  },

  // Hunting Horn songs (encore always assumed; not restricted by horn notes)
  {
    id: 'song:attack-s',
    label: 'Attack Up (S)',
    source: 'song',
    classes: HORN,
    toggle: { default: true },
    effects: [{ type: 'songRaw', group: 'song:raw', value: 15 }],
  },
  {
    id: 'song:attack-l',
    label: 'Attack Up (L)',
    source: 'song',
    classes: HORN,
    toggle: { default: true },
    effects: [{ type: 'songRaw', group: 'song:raw', value: 20 }],
  },
  {
    id: 'song:affinity',
    label: 'Affinity Up',
    source: 'song',
    classes: HORN,
    toggle: { default: true },
    effects: [{ type: 'affinityAdd', group: 'aff:song', value: 20 }],
  },
  {
    id: 'song:element',
    label: 'Element Up',
    source: 'song',
    classes: HORN,
    toggle: { default: true },
    effects: [{ type: 'songElement', group: 'song:element', value: 20 }],
  },

  // Insect Glaive kinsect buffs: three toggles, and two hidden combinations that carry the values (best wins).
  { id: 'kinsect:red', label: 'Red', source: 'kinsect', classes: GLAIVE, toggle: { default: true }, effects: [] },
  { id: 'kinsect:white', label: 'White', source: 'kinsect', classes: GLAIVE, toggle: { default: true }, effects: [] },
  { id: 'kinsect:orange', label: 'Orange', source: 'kinsect', classes: GLAIVE, toggle: { default: true }, effects: [] },
  {
    id: 'kinsect:red-white',
    label: 'Red + White',
    source: 'kinsect',
    classes: GLAIVE,
    effects: [{ type: 'rawPercent', group: 'raw-pct:kinsect', value: 20, needs: ['kinsect:red', 'kinsect:white'] }],
  },
  {
    id: 'kinsect:triple',
    label: 'Red + White + Orange',
    source: 'kinsect',
    classes: GLAIVE,
    effects: [{ type: 'rawPercent', group: 'raw-pct:kinsect', value: 25, needs: ['kinsect:red', 'kinsect:white', 'kinsect:orange'] }],
  },
]
