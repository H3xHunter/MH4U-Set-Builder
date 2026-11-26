import type { Weapon } from '@/data/types'
import * as T from './damageTables'
import { activeTier } from './skills'
import { hunterTypeOfClass } from './weaponClass'

/*
 * Effective raw (EFR) and effective element (EFE) of a build. Pure; no React, no storage.
 * Formulas and numbers are the owner's (docs/damage-model.md), including the marked assumptions.
 * Blademasters only: a gunner gets `ok: false`. Nothing here depends on motion values or monster hitzones.
 */

export interface DamageToggles {
  powercharm: boolean
  powertalon: boolean
  /** A large monster in the area is angry: Challenger applies. */
  raged: boolean
  kinsectRed: boolean
  kinsectWhite: boolean
  kinsectOrange: boolean
  songAttackS: boolean
  songAttackL: boolean
  songAffinity: boolean
  songElement: boolean
}

/** Items off; raged, kinsect buffs and songs on. */
export const DEFAULT_TOGGLES: Readonly<DamageToggles> = {
  powercharm: false,
  powertalon: false,
  raged: true,
  kinsectRed: true,
  kinsectWhite: true,
  kinsectOrange: true,
  songAttackS: true,
  songAttackL: true,
  songAffinity: true,
  songElement: true,
}

/** For toggles that may come from storage: anything that is not a boolean falls back to its default; unknown keys are dropped. */
export function parseToggles(raw: unknown): DamageToggles {
  const src = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const out = { ...DEFAULT_TOGGLES }
  for (const k of Object.keys(out) as (keyof DamageToggles)[]) {
    const v = Object.hasOwn(src, k) ? src[k] : undefined
    if (typeof v === 'boolean') out[k] = v
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

export interface ElementResult {
  kind: 'element' | 'element2' | 'awaken'
  type: string
  shownBase: number
  efeShown: number
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
      elements: ElementResult[]
      /** The weapon has an awaken element that no active skill unlocks. */
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

/** The tier of `table` active at `points` (highest threshold reached; for negative points the closest negative one). */
function activeEntry<V>(table: Readonly<Record<number, V>>, points: number): { threshold: number; value: V } | undefined {
  const t = activeTier(Object.keys(table).map((k) => ({ points: Number(k), name: '' })), points)
  return t ? { threshold: t.points, value: table[t.points] } : undefined
}

/** Values of the active tier of each tree of a group. */
const groupValues = (group: T.TreeTiers, skills: SkillTotals): number[] =>
  Object.entries(group).flatMap(([id, tiers]) => activeEntry(tiers, skills[Number(id)] ?? 0)?.value ?? [])

const best = (v: number[]) => Math.max(0, ...v)
const worst = (v: number[]) => Math.min(0, ...v)
/** The best positive value plus the worst negative one. */
const groupSum = (v: number[]) => best(v) + worst(v)

const atLeast = (trees: Readonly<Record<number, number>>, skills: SkillTotals): boolean =>
  Object.entries(trees).some(([id, threshold]) => (skills[Number(id)] ?? 0) >= threshold)

/** Weapon base affinity in percentage points; a double-affinity weapon uses the average of its two values. */
const baseAffinity = (w: Weapon): number =>
  w.affinityOptions ? (w.affinityOptions[0] + w.affinityOptions[1]) / 2 : (w.affinity ?? 0)

export function calculateDamage({ weapon, skills, toggles, sharpnessColor }: DamageInput): DamageResult {
  const r0 = trueRaw(weapon)
  const mult = classMultiplier(weapon.class)
  if (r0 === null || mult === null) return { ok: false, reason: 'Unknown weapon class.', trueRaw: null }
  if (hunterTypeOfClass(weapon.class) !== 'blade') return { ok: false, reason: 'Gunner damage is not modeled yet.', trueRaw: r0 }

  const bar = atLeast(T.SHARPNESS_PLUS_TREES, skills) ? 'plus' : 'base'
  const points = weapon.sharpness?.[bar]
  const selectable = points ? points.flatMap((p, i) => (p > 0 ? i : [])) : []
  if (selectable.length === 0) return { ok: false, reason: 'No usable sharpness data for this weapon.', trueRaw: r0 }
  const top = selectable[selectable.length - 1]
  const selected = sharpnessColor !== undefined && selectable.includes(sharpnessColor) ? sharpnessColor : top

  const horn = weapon.class === 'Hunting Horn'
  const glaive = weapon.class === 'Insect Glaive'
  const raged = toggles.raged

  // Raw: percent groups multiply, then flat groups add.
  const { kinsectRed: red, kinsectWhite: white, kinsectOrange: orange } = toggles
  const kinsect = !glaive ? 0 : red && white && orange ? T.KINSECT_TRIPLE_PERCENT : red && white ? T.KINSECT_RED_WHITE_PERCENT : 0
  const flat =
    groupSum(groupValues(T.RAW_FLAT_G1, skills)) +
    (toggles.powercharm ? T.POWERCHARM_FLAT : 0) +
    (toggles.powertalon ? T.POWERTALON_FLAT : 0) +
    (raged ? groupSum(groupValues(T.CHALLENGER_RAW, skills)) : 0)
  const rawBeforeSong = r0 * (1 + kinsect / 100) + flat

  const songAtk = !horn ? 0 : Math.max(toggles.songAttackS ? T.SONG_ATTACK_S_PERCENT : 0, toggles.songAttackL ? T.SONG_ATTACK_L_PERCENT : 0)
  const songElem = horn && toggles.songElement ? T.SONG_ELEMENT_PERCENT : 0

  // ASSUMPTION: affinity is clamped to [-100, 100] percentage points.
  const rawAffinity =
    baseAffinity(weapon) +
    groupSum(groupValues(T.AFFINITY_GROUP, skills)) +
    (raged ? groupSum(groupValues(T.CHALLENGER_AFFINITY, skills)) : 0) +
    (horn && toggles.songAffinity ? T.SONG_AFFINITY_POINTS : 0)
  const affinity = Math.min(100, Math.max(-100, rawAffinity))
  const critFactor = 1 + (T.CRIT_BONUS * affinity) / 100 // negative affinity: 1 - 0.25 * |A|

  const efrTrue = rawBeforeSong * (1 + songAtk / 100) * T.SHARPNESS_RAW[selected] * critFactor

  // Element. A negative group or (Ele) Atk tier divides by its factor (and subtracts its flat) instead of multiplying.
  const pct = groupValues(T.ELEMENT_PERCENT_GROUP, skills)
  const pctFactor = (1 + best(pct) / 100) / (1 - worst(pct) / 100)
  const awakenActive = atLeast(T.AWAKEN_TREES, skills)
  const instances = [
    ['element', weapon.element],
    ['element2', weapon.element2],
    ['awaken', awakenActive ? weapon.awaken : null],
  ] as const
  const elements: ElementResult[] = instances.flatMap(([kind, e]) => {
    if (!e) return []
    let pre = e.value * pctFactor
    const treeId = Number(Object.keys(T.ELEMENT_ATK_TREES).find((id) => T.ELEMENT_ATK_TREES[Number(id)] === e.type))
    const points = Number.isNaN(treeId) ? 0 : (skills[treeId] ?? 0)
    const tier = Number.isNaN(treeId) ? undefined : activeEntry(T.ELEMENT_ATK_TIERS, points)
    if (tier) pre = tier.threshold > 0 ? pre * tier.value.mult + tier.value.flat : pre / tier.value.mult - tier.value.flat
    // ASSUMPTION: element damage never goes below 0.
    const efeShown = Math.max(0, pre) * (1 + songElem / 100) * T.SHARPNESS_ELEMENT[selected]
    return [{ kind, type: e.type, shownBase: e.value, efeShown }]
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
    elements,
    awakenLocked: weapon.awaken !== null && !awakenActive,
    weaknessExploit: atLeast(T.WEAKNESS_EXPLOIT_TREES, skills),
  }
}
