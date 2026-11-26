import { describe, expect, it } from 'vitest'
import { loadRealData } from '@/data/real-data-fixture'
import type { Weapon } from '@/data/types'
import { mkWeapon } from '@/state/fixtures'
import { calculateDamage, classMultiplier, defaultToggles, trueRaw, type SkillTotals } from './damage'
import { CLASS_MULTIPLIERS } from './damageTables'

const data = loadRealData()
const real = (id: number): Weapon => {
  const w = data.weapons.find((x) => x.id === id)
  if (!w) throw new Error(`weapon ${id}`)
  return w
}

/** Only the white color has points, so the sharpness multipliers are 1.32 / 1.125. */
const WHITE = { base: [0, 0, 0, 0, 0, 1, 0], plus: [0, 0, 0, 0, 0, 1, 0] } as Weapon['sharpness']
const GREEN = { base: [0, 0, 0, 1, 0, 0, 0], plus: [0, 0, 0, 1, 0, 0, 0] } as Weapon['sharpness'] // raw 1.05, element 1.00

const PC = 'item:powercharm'
const PT = 'item:powertalon'
const RAGED = 'skill:challenger'
const RED = 'kinsect:red'
const WHITE_K = 'kinsect:white'
const ORANGE = 'kinsect:orange'
const SONG_S = 'song:attack-s'
const SONG_L = 'song:attack-l'
const SONG_AFF = 'song:affinity'
const SONG_ELE = 'song:element'

/** Skills on (they only act when the build has the skill), everything else off except the buff ids in `on`. */
const BASE = Object.fromEntries(Object.keys(defaultToggles()).map((k) => [k, k.startsWith('skill:') && k !== RAGED]))
const calc = (weapon: Weapon, skills: SkillTotals = {}, on: string[] = [], sharpnessColor?: number) => {
  const toggles = { ...BASE, ...Object.fromEntries(on.map((k) => [k, true])) }
  const r = calculateDamage({ weapon, skills, toggles, sharpnessColor })
  if (!r.ok) throw new Error(r.reason)
  return r
}
const horn = (over: Partial<Weapon> = {}) => mkWeapon(1, 0, { class: 'Hunting Horn', attack: 1248, affinity: 30, sharpness: WHITE, ...over })

describe('trueRaw and class multipliers', () => {
  it('divides the displayed attack by the class multiplier', () => {
    expect(trueRaw(real(5014))).toBe(240)
    expect(trueRaw(real(5984))).toBe(240)
    expect(trueRaw(real(6746))).toBe(230)
    expect(classMultiplier('Bow')).toBe(1.2)
    expect(classMultiplier('Spoon')).toBeNull()
    expect(classMultiplier('toString')).toBeNull()
    expect(trueRaw({ attack: 100, class: 'Spoon' })).toBeNull()
  })

  it('every weapon in the data divides exactly (integer arithmetic)', () => {
    const bad = data.weapons.filter((w) => {
      const m = CLASS_MULTIPLIERS[w.class]
      return m === undefined || (w.attack * 10) % Math.round(m * 10) !== 0
    })
    expect(bad.map((w) => w.id)).toEqual([])
    expect(Object.keys(CLASS_MULTIPLIERS)).toHaveLength(14)
  })
})

describe('raw, affinity and sharpness: Great Sword 5014 (1152 attack, +30%)', () => {
  const skills = { 31: 20 }
  it('Attack Up (L), Powercharm, white', () => {
    const r = calc(real(5014), skills, [PC])
    expect(r).toMatchObject({ trueRaw: 240, rawBeforeSong: 266, affinity: 30 })
    expect(r.critFactor).toBeCloseTo(1.075, 10)
    expect(r.sharpness).toMatchObject({ bar: 'base', selected: 5 })
    expect(r.efrTrue).toBeCloseTo(377.454, 6)
    expect(r.efrDisplayed).toBeCloseTo(1811.7792, 4)
  })

  it('real Fire weapon 5090 (1296 attack, 0% affinity, Fire 620): raw 296, EFR 390.72, EFE 697.5', () => {
    const w = real(5090)
    expect(w).toMatchObject({ class: 'Great Sword', attack: 1296, affinity: 0, element: { type: 'Fire', value: 620 }, element2: null, awaken: null })
    const r = calc(w, skills, [PC])
    expect(r.rawBeforeSong).toBe(296) // 1296 / 4.8 = 270, + 20 + 6
    expect(r.sharpness.selected).toBe(5)
    expect(r.efrTrue).toBeCloseTo(296 * 1.32, 6) // 390.72
    expect(r.efrDisplayed).toBeCloseTo(296 * 1.32 * 4.8, 4) // 1875.456
    expect(r.instances).toEqual([{ kind: 'element', slot: 'element', type: 'Fire', shownBase: 620, effectiveShown: expect.closeTo(620 * 1.125, 6) }]) // 697.5
  })

  it('Attack Up (L) song on a Hunting Horn with the same numbers: 452.9448', () => {
    const r = calc(horn({ element: { type: 'Fire', value: 470 } }), skills, [PC, SONG_L])
    expect(r.rawBeforeSong).toBe(266)
    expect(r.efrTrue).toBeCloseTo(452.9448, 4)
    expect(r.instances[0].effectiveShown).toBeCloseTo(528.75, 6) // 470 * 1.125
  })

  it('songs apply only to a Hunting Horn', () => {
    expect(calc(real(5014), skills, [PC, SONG_S, SONG_L, SONG_AFF, SONG_ELE]).efrTrue).toBeCloseTo(377.454, 6)
  })

  it('song rules: Attack Up S and L do not stack; Affinity Up adds 20; Element Up multiplies', () => {
    const h = horn({ element: { type: 'Fire', value: 470 } })
    expect(calc(h, {}, [SONG_S]).efrTrue).toBeCloseTo(240 * 1.15 * 1.32 * 1.075, 6)
    expect(calc(h, {}, [SONG_S, SONG_L]).efrTrue).toBeCloseTo(240 * 1.2 * 1.32 * 1.075, 6)
    const aff = calc(h, {}, [SONG_AFF])
    expect(aff.affinity).toBe(50)
    expect(aff.critFactor).toBeCloseTo(1.125, 10)
    expect(calc(h, {}, [SONG_ELE]).instances[0].effectiveShown).toBeCloseTo(470 * 1.2 * 1.125, 6)
  })

  it('Insect Glaive kinsect: triple is +25% before the flats', () => {
    const ig = mkWeapon(2, 0, { class: 'Insect Glaive', attack: 744, affinity: 0, sharpness: WHITE })
    expect(calc(ig, skills, [PC, RED, WHITE_K, ORANGE]).rawBeforeSong).toBe(326) // 240 * 1.25 + 20 + 6
    expect(calc(ig, skills, [PC, RED, WHITE_K]).rawBeforeSong).toBe(314) // 240 * 1.2 + 26
    expect(calc(ig, skills, [PC, RED, ORANGE]).rawBeforeSong).toBe(266)
    expect(calc(ig, skills, [PC, WHITE_K, ORANGE]).rawBeforeSong).toBe(266)
    expect(calc(real(5014), skills, [PC, RED, WHITE_K, ORANGE]).rawBeforeSong).toBe(266) // not a glaive
  })

  it('flat groups: Attack and Edgemaster share one group; Powertalon and Challenger add', () => {
    const gs = real(5014)
    expect(calc(gs, { 31: 20, 2: 10 }).rawBeforeSong).toBe(260) // +20, not +40
    expect(calc(gs, { 31: -10, 2: 10 }).rawBeforeSong).toBe(250) // -10 + 20
    expect(calc(gs, { 31: 25 }).rawBeforeSong).toBe(265)
    expect(calc(gs, { 31: 12 }).rawBeforeSong).toBe(250) // tier 10
    expect(calc(gs, { 31: -12 }).rawBeforeSong).toBe(230) // tier -10
    expect(calc(gs, { 31: 5 }).rawBeforeSong).toBe(240)
    expect(calc(gs, {}, [PT, PC]).rawBeforeSong).toBe(255)
    expect(calc(gs, { 26: 10 }, [RAGED]).rawBeforeSong).toBe(250)
    expect(calc(gs, { 26: 15 }, [RAGED]).rawBeforeSong).toBe(265)
    expect(calc(gs, { 26: 15 }, []).rawBeforeSong).toBe(240)
  })
})

describe('affinity', () => {
  it('negative affinity: crit 1 - 0.25 * |A|', () => {
    const r = calc(mkWeapon(1, 0, { affinity: -20, sharpness: WHITE }))
    expect(r.affinity).toBe(-20)
    expect(r.critFactor).toBeCloseTo(0.95, 10)
  })

  it('double affinity averages: -45/20 is -12.5', () => {
    const r = calc(real(5168))
    expect(real(5168).affinityOptions).toEqual([-45, 20])
    expect(r.affinity).toBe(-12.5)
    expect(r.critFactor).toBeCloseTo(1 - 0.25 * 0.125, 10)
  })

  it('Expert and Brutality share a group; Challenger and horn songs are separate', () => {
    const w = mkWeapon(1, 0, { affinity: 0, sharpness: WHITE })
    expect(calc(w, { 37: 20, 10: 10 }).affinity).toBe(20)
    expect(calc(w, { 37: 10, 10: 10 }).affinity).toBe(15)
    expect(calc(w, { 37: -15 }).affinity).toBe(-15)
    expect(calc(w, { 37: 10, 26: 15 }, [RAGED]).affinity).toBe(30)
    expect(calc(w, { 37: 10, 26: 15 }, []).affinity).toBe(10)
    expect(calc(horn({ affinity: 0 }), { 37: 10, 26: 15 }, [RAGED, SONG_AFF]).affinity).toBe(50)
  })

  it('is clamped to [-100, 100]', () => {
    expect(calc(mkWeapon(1, 0, { affinity: 90, sharpness: WHITE }), { 37: 30 }).affinity).toBe(100)
    expect(calc(mkWeapon(1, 0, { affinity: -90, sharpness: WHITE }), { 37: -20 }).critFactor).toBeCloseTo(0.75, 10)
  })
})

describe('element', () => {
  const fire = (over: Partial<Weapon> = {}) => mkWeapon(1, 0, { affinity: 0, sharpness: GREEN, element: { type: 'Fire', value: 300 }, ...over })

  it('(Ele) Atk tiers; Element Atk Up stacks as a multiplier', () => {
    expect(calc(fire(), { 79: 15 }).instances[0].effectiveShown).toBeCloseTo(390, 6) // 300 * 1.10 + 60
    expect(calc(fire(), { 79: 10 }).instances[0].effectiveShown).toBeCloseTo(355, 6)
    expect(calc(fire(), { 79: 20 }).instances[0].effectiveShown).toBeCloseTo(435, 6)
    expect(calc(fire(), { 79: 15, 84: 10 }).instances[0].effectiveShown).toBeCloseTo(423, 6) // 300 * 1.10 * 1.10 + 60
  })

  it('negative tiers are exact inverses', () => {
    expect(calc(fire(), { 84: -10 }).instances[0].effectiveShown).toBeCloseTo(300 / 1.1, 6)
    expect(calc(fire(), { 79: -10 }).instances[0].effectiveShown).toBeCloseTo(300 / 1.05 - 40, 6)
    expect(calc(fire({ element: { type: 'Fire', value: 40 } }), { 79: -10 }).instances[0].effectiveShown).toBe(0) // floored
  })

  it('percent group: best positive wins, a negative cancels', () => {
    expect(calc(fire(), { 84: 10, 14: 10, 140: 10 }).instances[0].effectiveShown).toBeCloseTo(330, 6)
    expect(calc(fire(), { 14: 10, 84: -10 }).instances[0].effectiveShown).toBeCloseTo(300, 6)
  })

  it('an (Ele) Atk tree applies only to its own type; element and element2 are separate instances', () => {
    const dual = fire({ element2: { type: 'Ice', value: 100 } })
    const r = calc(dual, { 79: 15, 82: 10 })
    expect(r.instances.map((e) => [e.slot, e.kind, e.type, Math.round(e.effectiveShown * 1000) / 1000])).toEqual([
      ['element', 'element', 'Fire', 390],
      ['element2', 'element', 'Ice', 145],
    ])
    expect(calc(fire({ element: { type: 'Water', value: 300 } }), { 79: 15 }).instances[0].effectiveShown).toBeCloseTo(300, 6)
  })

  it('an awaken element counts only with Awaken or Enlightened Blade', () => {
    const aw = mkWeapon(1, 0, { affinity: 0, sharpness: GREEN, awaken: { type: 'Ice', value: 410 } })
    const none = calc(aw, {})
    expect(none.instances).toEqual([])
    expect(none.awakenLocked).toBe(true)
    const on = calc(aw, { 17: 10 })
    expect(on.instances).toMatchObject([{ slot: 'awaken', kind: 'element', type: 'Ice', shownBase: 410 }])
    expect(on.instances[0].effectiveShown).toBeCloseTo(410, 6)
    expect(on.awakenLocked).toBe(false)
    expect(calc(aw, { 140: 10 }).instances[0].effectiveShown).toBeCloseTo(410 * 1.1, 6) // Arcana also adds +10%
    expect(calc(aw, { 17: 9 }).instances).toEqual([])
    expect(calc(real(5014), {}).awakenLocked).toBe(false)
  })
})

describe('status', () => {
  const poison = (over: Partial<Weapon> = {}) => horn({ element: { type: 'Poison', value: 470 }, ...over })
  const value = (skills: SkillTotals, on: string[] = [], w = poison()) => {
    const [i] = calc(w, skills, on).instances
    expect(i).toMatchObject({ kind: 'status', type: 'Poison', shownBase: 470 })
    return i.effectiveShown
  }

  it('the four status types; anything else is left out', () => {
    for (const type of ['Poison', 'Paralysis', 'Sleep', 'Blastblight']) {
      expect(calc(poison({ element: { type, value: 100 } })).instances).toMatchObject([{ kind: 'status', type, effectiveShown: 100 }])
    }
    expect(calc(poison({ element: { type: 'Blast', value: 100 } })).instances).toEqual([])
  })

  it('ignores sharpness, songs and every element skill', () => {
    expect(value({})).toBe(470)
    expect(value({}, [SONG_S, SONG_L, SONG_AFF, SONG_ELE])).toBe(470)
    expect(value({ 84: 10, 14: 10, 79: 20, 80: 20, 81: 20, 82: 20, 83: 20 })).toBe(470)
    const low = calc(poison({ sharpness: { base: [1, 0, 0, 0, 0, 0, 0], plus: [1, 0, 0, 0, 0, 0, 0] } }))
    expect(low.sharpness.selected).toBe(0)
    expect(low.instances[0].effectiveShown).toBe(470)
  })

  it('Status Atk +1 is x1.125, +2 is x1.25, -10 divides by 1.125', () => {
    expect(value({ 48: 10 })).toBeCloseTo(528.75, 6)
    expect(value({ 48: 15 })).toBeCloseTo(587.5, 6)
    expect(value({ 48: -10 })).toBeCloseTo(470 / 1.125, 6)
    expect(value({ 48: 12 })).toBeCloseTo(528.75, 6) // tier 10
  })

  it('Enlightened Blade is +10% in the same group: best wins, no stacking', () => {
    expect(value({ 140: 10 })).toBeCloseTo(517, 6)
    expect(value({ 140: 10, 48: 10 })).toBeCloseTo(528.75, 6) // 12.5%, not 22.5%
    expect(value({ 140: 10, 48: 15 })).toBeCloseTo(587.5, 6)
    expect(value({ 140: 10, 48: -10 })).toBeCloseTo((470 * 1.1) / 1.125, 6)
  })

  it('a status-skill does not touch an element instance', () => {
    const [i] = calc(mkWeapon(1, 0, { affinity: 0, sharpness: GREEN, element: { type: 'Fire', value: 300 } }), { 48: 15 }).instances
    expect(i).toMatchObject({ kind: 'element', effectiveShown: 300 })
  })

  it('a dual weapon computes each instance on its own (element and status)', () => {
    const r = calc(poison({ element: { type: 'Fire', value: 300 }, element2: { type: 'Poison', value: 100 }, sharpness: GREEN }), { 48: 10, 79: 15 })
    expect(r.instances.map((i) => [i.kind, i.type, Math.round(i.effectiveShown * 1000) / 1000])).toEqual([
      ['element', 'Fire', 390],
      ['status', 'Poison', 112.5],
    ])
  })
})

describe('sharpness', () => {
  it('base vs plus bar and selectable colors; Rinforzato tops out at white, then purple', () => {
    const h = real(5984)
    const base = calc(h)
    expect(base.sharpness).toEqual({ bar: 'base', selectable: [0, 1, 2, 3, 4, 5], selected: 5 })
    const plus = calc(h, { 19: 10 })
    expect(plus.sharpness).toEqual({ bar: 'plus', selectable: [0, 1, 2, 3, 4, 5, 6], selected: 6 })
    expect(calc(h, { 2: 10 }).sharpness.bar).toBe('plus')
    expect(calc(h, { 19: 9 }).sharpness.bar).toBe('base')
    expect(plus.efrTrue / base.efrTrue).toBeCloseTo(1.45 / 1.32, 10)
  })

  it('a chosen color is used when it has points; otherwise the default (top) color', () => {
    const h = real(5984)
    expect(calc(h, {}, [], 2).sharpness.selected).toBe(2)
    expect(calc(h, {}, [], 2).efrTrue / calc(h).efrTrue).toBeCloseTo(1.0 / 1.32, 10)
    expect(calc(h, {}, [], 6).sharpness.selected).toBe(5) // purple has no points on the base bar
    expect(calc(h, { 19: 10 }, [], 6).sharpness.selected).toBe(6)
    expect(calc(h, {}, [], 99).sharpness.selected).toBe(5)
    expect(calc(h, {}, [], -1).sharpness.selected).toBe(5)
  })
})

describe('unavailable results and flags', () => {
  const OFF = BASE
  it('gunners, missing sharpness, unknown class', () => {
    const bow = calculateDamage({ weapon: mkWeapon(1, 0, { class: 'Bow', attack: 120 }), skills: {}, toggles: OFF })
    expect(bow).toMatchObject({ ok: false, trueRaw: 100, reason: expect.stringContaining('Gunner') })
    const noSharp = calculateDamage({ weapon: real(7324), skills: {}, toggles: OFF })
    expect(noSharp).toMatchObject({ ok: false, reason: expect.stringContaining('sharpness') })
    expect(real(7324).sharpness).toBeNull()
    expect(calculateDamage({ weapon: mkWeapon(1, 0, { class: 'Spoon' }), skills: {}, toggles: OFF })).toMatchObject({ ok: false, trueRaw: null })
  })

  it('Weakness Exploit is a flag only', () => {
    const w = real(5014)
    expect(calc(w, { 29: 10 }).weaknessExploit).toBe(true)
    expect(calc(w, { 10: 10 }).weaknessExploit).toBe(true)
    expect(calc(w, { 29: 9, 10: 5 }).weaknessExploit).toBe(false)
    expect(calc(w, { 29: 10 }).efrTrue).toBeCloseTo(calc(w, {}).efrTrue, 10)
    expect(calc(w, { 10: 10 }).affinity).toBe(45) // Ruthlessness's +15 affinity still applies
  })
})
