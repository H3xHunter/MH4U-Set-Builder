import {
  ARMOR_SLOTS,
  type Armor,
  type ArmorSlot,
  type Decoration,
  type GameData,
  type SavedCharm,
  type Weapon,
  type SlotCount,
} from '@/data/types'
import { canAdd } from '@/lib/slots'

export type WeaponSelection =
  | { kind: 'none' }
  | { kind: 'slots'; slots: SlotCount }
  | { kind: 'data'; weaponId: number }

export interface ArmorSelection {
  armorId: number
  decos: number[]
}

export interface BuildState {
  weapon: WeaponSelection
  weaponDecos: number[]
  armor: Record<ArmorSlot, ArmorSelection | null>
  charm: { charmId: string | null; decos: number[] }
  armorLevel: 'normal' | 'max'
}

export type Target = { kind: 'weapon' } | { kind: 'armor'; slot: ArmorSlot } | { kind: 'charm' }

export type Action =
  | { type: 'setWeapon'; weapon: WeaponSelection }
  | { type: 'setArmor'; slot: ArmorSlot; armorId: number | null }
  | { type: 'addDeco'; target: Target; decoId: number }
  | { type: 'removeDeco'; target: Target; index: number }
  | { type: 'setCharm'; charmId: string | null }
  | { type: 'setArmorLevel'; level: BuildState['armorLevel'] }
  | { type: 'reset' }

export interface BuildContext {
  data: GameData
  charms: SavedCharm[]
}

export const emptyBuild = (): BuildState => ({
  weapon: { kind: 'none' },
  weaponDecos: [],
  armor: { head: null, chest: null, arms: null, waist: null, legs: null },
  charm: { charmId: null, decos: [] },
  armorLevel: 'normal',
})

interface Index {
  armor: Map<number, Armor>
  decorations: Map<number, Decoration>
  weapons: Map<number, Weapon>
}
const indexes = new WeakMap<GameData, Index>()
const indexOf = (data: GameData): Index => {
  let i = indexes.get(data)
  if (!i) {
    i = {
      armor: new Map(data.armor.map((x) => [x.id, x])),
      decorations: new Map(data.decorations.map((x) => [x.id, x])),
      weapons: new Map(data.weapons.map((x) => [x.id, x])),
    }
    indexes.set(data, i)
  }
  return i
}

/** Memoized per data set (built once). */
export const weaponsById = (data: GameData): ReadonlyMap<number, Weapon> => indexOf(data).weapons
export const armorById = (data: GameData): ReadonlyMap<number, Armor> => indexOf(data).armor

export const findArmor = (ctx: BuildContext, id: number) => indexOf(ctx.data).armor.get(id) ?? null
export const findDeco = (ctx: BuildContext, id: number) => indexOf(ctx.data).decorations.get(id) ?? null

export const resolveWeapon = (s: BuildState, ctx: BuildContext): Weapon | null =>
  s.weapon.kind === 'data' ? (indexOf(ctx.data).weapons.get(s.weapon.weaponId) ?? null) : null

/** A charm id missing from ctx.charms behaves as no charm. */
export const resolveCharm = (s: BuildState, ctx: BuildContext): SavedCharm | null =>
  s.charm.charmId === null ? null : (ctx.charms.find((c) => c.id === s.charm.charmId) ?? null)

export const decosOf = (s: BuildState, t: Target): number[] =>
  t.kind === 'weapon' ? s.weaponDecos : t.kind === 'charm' ? s.charm.decos : (s.armor[t.slot]?.decos ?? [])

export function capacityOf(s: BuildState, t: Target, ctx: BuildContext): number {
  if (t.kind === 'weapon') {
    return s.weapon.kind === 'slots' ? s.weapon.slots : (resolveWeapon(s, ctx)?.slots ?? 0)
  }
  if (t.kind === 'charm') return resolveCharm(s, ctx)?.slots ?? 0
  const piece = s.armor[t.slot]
  return piece ? (findArmor(ctx, piece.armorId)?.slots ?? 0) : 0
}

export function canAddDeco(s: BuildState, t: Target, decoId: number, ctx: BuildContext): boolean {
  const deco = findDeco(ctx, decoId)
  if (!deco) return false
  const current = decosOf(s, t).flatMap((id) => findDeco(ctx, id) ?? [])
  return canAdd(capacityOf(s, t, ctx), current, deco)
}

function withDecos(s: BuildState, t: Target, decos: number[]): BuildState {
  if (t.kind === 'weapon') return { ...s, weaponDecos: decos }
  if (t.kind === 'charm') return { ...s, charm: { ...s.charm, decos } }
  const piece = s.armor[t.slot]
  return piece ? { ...s, armor: { ...s.armor, [t.slot]: { ...piece, decos } } } : s
}

const ALL_TARGETS: Target[] = [
  { kind: 'weapon' },
  { kind: 'charm' },
  ...ARMOR_SLOTS.map((slot): Target => ({ kind: 'armor', slot })),
]

/**
 * Unequips a charm that is no longer in the list, and drops decorations that no longer fit any container: the longest prefix that fits is kept,
 * the rest is dropped from the end. Returns the same object when nothing changes, so the UI
 * can also call it when the saved charm list changes.
 */
export function normalizeBuild(s: BuildState, ctx: BuildContext): BuildState {
  // A deleted charm is unequipped (its decorations go with it).
  let out = s.charm.charmId !== null && !resolveCharm(s, ctx) ? { ...s, charm: { charmId: null, decos: [] } } : s
  for (const t of ALL_TARGETS) {
    const decos = decosOf(out, t)
    const capacity = capacityOf(out, t, ctx)
    let used = 0
    let keep = 0
    for (const id of decos) {
      const size = findDeco(ctx, id)?.size ?? Infinity
      if (used + size > capacity) break
      used += size
      keep++
    }
    if (keep < decos.length) out = withDecos(out, t, decos.slice(0, keep))
  }
  return out
}

/** Rejected actions return the very same `state` object. */
export function applyAction(state: BuildState, action: Action, ctx: BuildContext): BuildState {
  switch (action.type) {
    case 'setWeapon': {
      const w = action.weapon
      if (w.kind === 'data' && !indexOf(ctx.data).weapons.has(w.weaponId)) return state
      if (w.kind === 'slots' && ![0, 1, 2, 3].includes(w.slots)) return state
      return normalizeBuild({ ...state, weapon: w }, ctx)
    }
    case 'setArmor': {
      if (action.armorId === null) {
        return { ...state, armor: { ...state.armor, [action.slot]: null } }
      }
      // A piece only goes in its own slot: Torso Up logic relies on the slot.
      if (findArmor(ctx, action.armorId)?.slot !== action.slot) return state
      const piece = { armorId: action.armorId, decos: state.armor[action.slot]?.decos ?? [] }
      return normalizeBuild({ ...state, armor: { ...state.armor, [action.slot]: piece } }, ctx)
    }
    case 'addDeco':
      if (!canAddDeco(state, action.target, action.decoId, ctx)) return state
      return withDecos(state, action.target, [...decosOf(state, action.target), action.decoId])
    case 'removeDeco': {
      const decos = decosOf(state, action.target)
      if (!Number.isInteger(action.index) || action.index < 0 || action.index >= decos.length) return state
      return withDecos(state, action.target, decos.filter((_, i) => i !== action.index))
    }
    case 'setCharm':
      return normalizeBuild({ ...state, charm: { ...state.charm, charmId: action.charmId } }, ctx)
    case 'setArmorLevel':
      return { ...state, armorLevel: action.level }
    case 'reset':
      return emptyBuild()
  }
}
