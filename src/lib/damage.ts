import type { Weapon } from '@/data/types'
import { BUFF_SOURCES, BUFFS, EFFECT_TYPES, type Buff, type BuffSource, type EffectType } from './buffRegistry'
import * as T from './damageTables'
import { activeTier } from './skills'
import { hunterTypeOfClass } from './weaponClass'

/*
 * Effective raw (EFR) and effective element/status of a build. Pure; no React, no storage.
 * The numbers live in buffRegistry.ts and damageTables.ts (the owner's, see docs/damage-model.md); this file only
 * collects the active effects, groups them and combines them by type in the fixed order of FORMULA_ORDER.
 * Blademasters only: a gunner gets `ok: false`. Nothing here depends on motion values or monster hitzones.
 */

export type Registry = readonly Buff[]

/** Buff id -> on/off. An id that is missing uses the buff's default. */
export type DamageToggles = Readonly<Record<string, boolean>>

const MAX_TOGGLE_KEYS = 256

/** The default state of every toggleable buff of the registry. */
export const defaultToggles = (registry: Registry = BUFFS): Record<string, boolean> =>
  Object.fromEntries(registry.flatMap((b) => (b.toggle ? [[b.id, b.toggle.default]] : [])))

/** Items off; raged monster, songs and kinsect buffs on. */
export const DEFAULT_TOGGLES: DamageToggles = defaultToggles()

/**
 * For toggles that may come from storage (untrusted): only a plain object counts; only ids of the registry with a boolean
 * value are kept (over the defaults); everything else is dropped; at most MAX_TOGGLE_KEYS keys are looked at. Never throws.
 */
export function parseToggles(raw: unknown, registry: Registry = BUFFS): Record<string, boolean> {
  const out = defaultToggles(registry)
  try {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out
    const proto = Object.getPrototypeOf(raw)
    if (proto !== Object.prototype && proto !== null) return out
    const known = new Set(Object.keys(out))
    for (const k of Object.keys(raw).slice(0, MAX_TOGGLE_KEYS)) {
      const v = (raw as Record<string, unknown>)[k]
      if (known.has(k) && typeof v === 'boolean') out[k] = v
    }
  } catch {
    // A hostile object (a throwing getter or proxy) leaves the defaults.
  }
  return out
}

/** Total skill points per tree id (armor + charm + decorations, Torso Up included). */
export type SkillTotals = Readonly<Record<number, number>>

export interface DamageInput {
  weapon: Weapon
  skills: SkillTotals
  toggles: DamageToggles
  /** Sharpness color 0..6; used only if it has points in the active bar, else the default (top color). */
  sharpnessColor?: number
}

export interface InstanceResult {
  /** 'element' (Fire, Water, Thunder, Ice, Dragon) or 'status' (Poison, Paralysis, Sleep, Blastblight). */
  kind: 'element' | 'status'
  /** Which weapon field it came from. */
  slot: 'element' | 'element2' | 'awaken'
  type: string
  shownBase: number
  /** Element: effective element damage (sharpness and songs applied). Status: buildup value (a higher value is faster buildup, not more damage). */
  effectiveShown: number
}

export interface SharpnessInfo {
  bar: 'base' | 'plus'
  selectable: number[]
  selected: number
}

export type DamageResult =
  | { ok: false; reason: string; trueRaw: number | null }
  | {
      ok: true
      trueRaw: number
      /** True raw after percent and flat groups, before songs, sharpness and crit. */
      rawBeforeSong: number
      /** Percentage points, clamped to [-100, 100]. */
      affinity: number
      critFactor: number
      sharpness: SharpnessInfo
      efrTrue: number
      efrDisplayed: number
      instances: InstanceResult[]
      /** The weapon has an awaken element that no active buff unlocks. */
      awakenLocked: boolean
      weaknessExploit: boolean
    }

export const classMultiplier = (weaponClass: string): number | null =>
  Object.hasOwn(T.CLASS_MULTIPLIERS, weaponClass) ? T.CLASS_MULTIPLIERS[weaponClass] : null

/** Attack / class multiplier, done in tenths so the division is exact; null for an unknown class. */
export function trueRaw(weapon: Pick<Weapon, 'attack' | 'class'>): number | null {
  const m = classMultiplier(weapon.class)
  return m === null ? null : (weapon.attack * 10) / Math.round(m * 10)
}

/** The tier of a skill buff that the total points reach (highest positive tier; for negative points the closest negative one). */
const tierOf = (b: Buff, skills: SkillTotals): number | null =>
  b.skill ? (activeTier(b.skill.tiers.map((points) => ({ points, name: '' })), skills[b.skill.tree] ?? 0)?.points ?? null) : null

/** A buff exists for this build: its class fits and its skill reaches a tier. */
const isAvailable = (b: Buff, weapon: Weapon, skills: SkillTotals): boolean =>
  (!b.classes || b.classes.includes(weapon.class)) && (!b.skill || tierOf(b, skills) !== null)

const toggleState = (b: Buff, toggles: DamageToggles): boolean =>
  Object.hasOwn(toggles, b.id) && typeof toggles[b.id] === 'boolean' ? toggles[b.id] : (b.toggle?.default ?? true)

export interface ToggleEntry {
  id: string
  label: string
  condition: string | null
  default: boolean
}

/** The toggleable buffs to show for this build, by source (skill, item, song, kinsect); empty sources are left out. */
export function listToggles(weapon: Weapon, skills: SkillTotals, registry: Registry = BUFFS): { source: BuffSource; buffs: ToggleEntry[] }[] {
  return BUFF_SOURCES.map((source) => ({
    source,
    buffs: registry
      .filter((b) => b.source === source && b.toggle && isAvailable(b, weapon, skills))
      .map((b) => ({ id: b.id, label: b.label, condition: b.toggle?.condition ?? null, default: b.toggle?.default ?? true })),
  })).filter((g) => g.buffs.length > 0)
}

/** An effect of an active buff, resolved for the buff's tier: v is a signed amount (add types) or a factor (mult types). */
interface Active {
  type: EffectType
  group: string
  element?: string
  v: number
}

function activeEffects(weapon: Weapon, skills: SkillTotals, toggles: DamageToggles, registry: Registry): Active[] {
  const on = registry.filter((b) => isAvailable(b, weapon, skills) && toggleState(b, toggles))
  const ids = new Set(on.map((b) => b.id))
  const out: Active[] = []
  for (const b of on) {
    const tier = tierOf(b, skills)
    for (const e of b.effects) {
      if (e.needs && !e.needs.every((id) => ids.has(id))) continue
      const mode = EFFECT_TYPES[e.type]
      if (mode === 'flag') {
        out.push({ type: e.type, group: e.group, v: 1 })
        continue
      }
      // A negative tier -n is the exact inverse of tier n.
      const amount = typeof e.value === 'number' ? e.value : tier === null ? undefined : e.value?.[Math.abs(tier)]
      if (amount === undefined) continue
      const inverse = tier !== null && tier < 0
      const v = mode === 'add' ? (inverse ? -amount : amount) : inverse ? 1 / (1 + amount / 100) : 1 + amount / 100
      out.push({ type: e.type, group: e.group, element: e.element, v })
    }
  }
  return out
}

/**
 * Combine the effects of one type: inside a group the best positive value wins and the worst negative one applies on top;
 * then add types sum their groups and mult types multiply them. `element` filters effects restricted to one element type.
 */
function combine(active: Active[], type: EffectType, element?: string): number {
  const add = EFFECT_TYPES[type] === 'add'
  const groups = new Map<string, number[]>()
  for (const e of active) {
    if (e.type !== type || (e.element !== undefined && e.element !== element)) continue
    groups.set(e.group, [...(groups.get(e.group) ?? []), e.v])
  }
  let total = add ? 0 : 1
  for (const v of groups.values()) {
    if (add) total += Math.max(0, ...v) + Math.min(0, ...v)
    else total *= Math.max(1, ...v) * Math.min(1, ...v)
  }
  return total
}

const hasFlag = (active: Active[], type: EffectType) => active.some((e) => e.type === type)

/** The effect types in the order the formula uses them. A test keeps this equal to EFFECT_TYPES. */
export const FORMULA_ORDER: readonly EffectType[] = [
  'rawPercent',
  'rawFlat',
  'songRaw',
  'affinityAdd',
  'elementPercent',
  'elementMult',
  'elementFlat',
  'songElement',
  'statusPercent',
  'awaken',
  'sharpnessPlus',
  'weaknessExploit',
]

/** Weapon base affinity in percentage points; a double-affinity weapon uses the average of its two values. */
const baseAffinity = (w: Weapon): number =>
  w.affinityOptions ? (w.affinityOptions[0] + w.affinityOptions[1]) / 2 : (w.affinity ?? 0)

export function calculateDamage({ weapon, skills, toggles, sharpnessColor }: DamageInput, registry: Registry = BUFFS): DamageResult {
  const r0 = trueRaw(weapon)
  const mult = classMultiplier(weapon.class)
  if (r0 === null || mult === null) return { ok: false, reason: 'Unknown weapon class.', trueRaw: null }
  if (hunterTypeOfClass(weapon.class) !== 'blade') return { ok: false, reason: 'Gunner damage is not modeled yet.', trueRaw: r0 }

  const active = activeEffects(weapon, skills, toggles, registry)

  const bar = hasFlag(active, 'sharpnessPlus') ? 'plus' : 'base'
  const points = weapon.sharpness?.[bar]
  const selectable = points ? points.flatMap((p, i) => (p > 0 ? i : [])) : []
  if (selectable.length === 0) return { ok: false, reason: 'No usable sharpness data for this weapon.', trueRaw: r0 }
  const top = selectable[selectable.length - 1]
  const selected = sharpnessColor !== undefined && selectable.includes(sharpnessColor) ? sharpnessColor : top

  // Raw: percent groups multiply, then flat groups add, then the song multiplier.
  const rawBeforeSong = r0 * combine(active, 'rawPercent') + combine(active, 'rawFlat')

  // ASSUMPTION: affinity is clamped to [-100, 100] percentage points.
  const affinity = Math.min(100, Math.max(-100, baseAffinity(weapon) + combine(active, 'affinityAdd')))
  const critFactor = 1 + (T.CRIT_BONUS * affinity) / 100 // negative affinity: 1 - 0.25 * |A|

  const efrTrue = rawBeforeSong * combine(active, 'songRaw') * T.SHARPNESS_RAW[selected] * critFactor

  const awakenActive = hasFlag(active, 'awaken')
  const slots = [
    ['element', weapon.element],
    ['element2', weapon.element2],
    ['awaken', awakenActive ? weapon.awaken : null],
  ] as const
  const instances = slots.flatMap(([slot, e]): InstanceResult[] => {
    if (!e) return []
    if (T.STATUS_TYPES.includes(e.type)) {
      // A status is touched by statusPercent only: no sharpness, songs or element skills.
      return [{ kind: 'status', slot, type: e.type, shownBase: e.value, effectiveShown: e.value * combine(active, 'statusPercent') }]
    }
    if (!T.ELEMENT_TYPES.includes(e.type)) return []
    // ASSUMPTION: element damage never goes below 0.
    const pre = Math.max(0, e.value * combine(active, 'elementPercent') * combine(active, 'elementMult', e.type) + combine(active, 'elementFlat', e.type))
    const effectiveShown = pre * combine(active, 'songElement') * T.SHARPNESS_ELEMENT[selected]
    return [{ kind: 'element', slot, type: e.type, shownBase: e.value, effectiveShown }]
  })

  return {
    ok: true,
    trueRaw: r0,
    rawBeforeSong,
    affinity,
    critFactor,
    sharpness: { bar, selectable, selected },
    efrTrue,
    efrDisplayed: efrTrue * mult,
    instances,
    awakenLocked: weapon.awaken !== null && !awakenActive,
    weaknessExploit: hasFlag(active, 'weaknessExploit'),
  }
}
