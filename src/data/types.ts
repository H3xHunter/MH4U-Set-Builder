// Shapes of public/data/*.json, as documented in docs/data-format.md.

export const ARMOR_SLOTS = ['head', 'chest', 'arms', 'waist', 'legs'] as const
export type ArmorSlot = (typeof ARMOR_SLOTS)[number]

export const HUNTER_TYPES = ['blade', 'gunner', 'both'] as const
export type HunterType = (typeof HUNTER_TYPES)[number]

export const GENDERS = ['male', 'female', 'both'] as const
export type Gender = (typeof GENDERS)[number]

export const MATERIAL_KINDS = ['create', 'createA', 'createB', 'improve'] as const
export type MaterialKind = (typeof MATERIAL_KINDS)[number]

export const RANKS = ['LR', 'HR', 'G'] as const
export type Rank = (typeof RANKS)[number]

export const QUEST_KINDS = ['quest', 'arena'] as const
export type QuestKind = (typeof QUEST_KINDS)[number]

/** Skill tree id (as string, JSON key) -> points. */
export type SkillPoints = Record<string, number>

export interface Meta {
  dataVersion: number
  sourceUrl: string
  sourceCommit: string
  dbSha256: string
  license: string
  torsoUpTreeId: number
  counts: Record<string, number>
}

export interface SkillTier {
  points: number
  name: string
  description: string | null
}

export interface SkillTree {
  id: number
  name: string
  tiers: SkillTier[]
}

export interface ArmorMaterial {
  itemId: number
  quantity: number
  kind: MaterialKind
}

export interface Armor {
  id: number
  name: string
  slot: ArmorSlot
  hunterType: HunterType | null
  gender: Gender | null
  slots: number
  defense: number
  maxDefense: number | null
  res: { fire: number; water: number; thunder: number; ice: number; dragon: number }
  skills: SkillPoints
  torsoUp: boolean
  rarity: number
  materials: ArmorMaterial[]
}

export interface Decoration {
  id: number
  name: string
  size: number
  skills: SkillPoints
}

export interface WeaponElement {
  type: string
  value: number
}

export type SevenInts = [number, number, number, number, number, number, number]

export interface Weapon {
  id: number
  name: string
  class: string
  parentId: number | null
  final: boolean
  rarity: number
  attack: number
  maxAttack: number | null
  affinity: number | null
  affinityOptions: [number, number] | null
  element: WeaponElement | null
  element2: WeaponElement | null
  awaken: WeaponElement | null
  defenseBonus: number
  sharpness: { base: SevenInts; plus: SevenInts } | null
  slots: number
  hornNotes: string | null
  extra: Record<
    | 'shellingType'
    | 'phial'
    | 'charges'
    | 'coatings'
    | 'recoil'
    | 'reloadSpeed'
    | 'rapidFire'
    | 'deviation'
    | 'ammo'
    | 'specialAmmo',
    string | null
  >
}

export interface HornSong {
  notes: string
  song: string
  effect1: string
  effect2: string
  duration: string
  extension: string
}

export interface MaterialDrop {
  monsterId: number
  rank: Rank
  condition: string
  percentage: number | null
  stackSize: number
}

export interface MaterialGathering {
  locationId: number
  area: string
  site: string
  rank: Rank
  quantity: number
  percentage: number
}

export interface MaterialSources {
  quests: { questId: number; slot: string; percentage: number; stackSize: number }[]
  arena: { arenaQuestId: number; percentage: number; stackSize: number }[]
  combining: { item1Id: number; item2Id: number; amountMin: number; amountMax: number; percentage: number }[]
  veggieElder: { offerItemId: number; quantity: number }[]
  wyporium: { itemInId: number; itemOutId: number; unlockQuestId: number | null }[]
}

export interface Material {
  id: number
  name: string
  rarity: number
  drops: MaterialDrop[]
  gathering: MaterialGathering[]
  sources: MaterialSources
}

export interface Hitzone {
  part: string
  cut: number
  impact: number
  shot: number
  fire: number
  water: number
  ice: number
  thunder: number
  dragon: number
  ko: number
}

export interface Monster {
  id: number
  name: string
  class: string
  hitzones: Hitzone[]
}

export interface Location {
  id: number
  name: string
}

/** Identified by (kind, id): the two kinds have separate id spaces. */
export interface Quest {
  id: number
  kind: QuestKind
  name: string
  hub: string | null
  type: string | null
  stars: number | null
}

export interface Item {
  id: number
  name: string
  type: string
  rarity: number
}

export interface GameData {
  meta: Meta
  skills: SkillTree[]
  armor: Armor[]
  decorations: Decoration[]
  weapons: Weapon[]
  horn: HornSong[]
  materials: Material[]
  monsters: Monster[]
  locations: Location[]
  quests: Quest[]
  items: Item[]
}

export type SlotCount = 0 | 1 | 2 | 3

/** A user-made charm (see src/lib/charms.ts). */
export interface SavedCharm {
  id: string
  name: string
  slots: SlotCount
  skills: SkillPoints
}
