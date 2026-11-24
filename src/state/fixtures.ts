// Test-only builders for small GameData fixtures. Not imported by app code.
import type { Armor, ArmorSlot, Decoration, GameData, SkillTree, Weapon } from '@/data/types'

export const mkArmor = (id: number, slot: ArmorSlot, slots: number, over: Partial<Armor> = {}): Armor => ({
  id,
  name: `armor${id}`,
  slot,
  hunterType: 'both',
  gender: 'both',
  slots,
  defense: 10,
  maxDefense: 100,
  res: { fire: 0, water: 0, thunder: 0, ice: 0, dragon: 0 },
  skills: {},
  torsoUp: false,
  rarity: 1,
  materials: [],
  ...over,
})

export const mkDeco = (id: number, size: number, skills: Record<string, number> = {}): Decoration => ({
  id,
  name: `deco${id}`,
  size,
  skills,
  color: 'red',
})

export const mkWeapon = (id: number, slots: number, over: Partial<Weapon> = {}): Weapon => ({
  id,
  name: `weapon${id}`,
  class: 'Great Sword',
  parentId: null,
  final: false,
  rarity: 1,
  attack: 100,
  maxAttack: null,
  affinity: 0,
  affinityOptions: null,
  element: null,
  element2: null,
  awaken: null,
  defenseBonus: 0,
  sharpness: null,
  slots,
  hornNotes: null,
  extra: {
    shellingType: null,
    phial: null,
    charges: null,
    coatings: null,
    recoil: null,
    reloadSpeed: null,
    rapidFire: null,
    deviation: null,
    ammo: null,
    specialAmmo: null,
  },
  ...over,
})

export const mkData = (parts: Partial<GameData> = {}): GameData => ({
  meta: { dataVersion: 1, sourceUrl: '', sourceCommit: '', dbSha256: '', license: '', torsoUpTreeId: 0, counts: {} },
  skills: [] as SkillTree[],
  armor: [],
  decorations: [],
  weapons: [],
  horn: [],
  materials: [],
  monsters: [],
  locations: [],
  quests: [],
  items: [],
  ...parts,
})
