import { describe, expect, it } from 'vitest'
import { loadRealData } from '@/data/real-data-fixture'
import type { Weapon } from '@/data/types'
import { mkWeapon } from '@/state/fixtures'
import { calculateDamage, classMultiplier, DEFAULT_TOGGLES, parseToggles, trueRaw, type DamageToggles, type SkillTotals } from './damage'
import { CLASS_MULTIPLIERS, ELEMENT_ATK_TREES, tableThresholds } from './damageTables'

const data = loadRealData()
const real = (id: number): Weapon => {
  const w = data.weapons.find((x) => x.id === id)
  if (!w) throw new Error(`weapon ${id}`)
  return w
}

/** Only the white color has points, so the sharpness multipliers are 1.32 / 1.125. */
const WHITE = { base: [0, 0, 0, 0, 0, 1, 0], plus: [0, 0, 0, 0, 0, 1, 0] } as Weapon['sharpness']
const GREEN = { base: [0, 0, 0, 1, 0, 0, 0], plus: [0, 0, 0, 1, 0, 0, 0] } as Weapon['sharpness'] // raw 1.05, element 1.00

/** Everything off, so a test turns on only what it checks. */
const OFF: DamageToggles = {
  powercharm: false,
  powertalon: false,
  raged: false,
  kinsectRed: false,
  kinsectWhite: false,
  kinsectOrange: false,
  songAttackS: false,
  songAttackL: false,
  songAffinity: false,
  songElement: false,
}
const calc = (weapon: Weapon, skills: SkillTotals = {}, toggles: Partial<DamageToggles> = {}, sharpnessColor?: number) => {
  const r = calculateDamage({ weapon, skills, toggles: { ...OFF, ...toggles }, sharpnessColor })
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
    const r = calc(real(5014), skills, { powercharm: true })
    expect(r).toMatchObject({ trueRaw: 240, rawBeforeSong: 266, affinity: 30 })
    expect(r.critFactor).toBeCloseTo(1.075, 10)
    expect(r.sharpness).toMatchObject({ bar: 'base', selected: 5 })
    expect(r.efrTrue).toBeCloseTo(377.454, 6)
    expect(r.efrDisplayed).toBeCloseTo(1811.7792, 4)
  })

  it('Poison 470 at white: EFE 528.75, no skills', () => {
    const r = calc(real(5014), skills, { powercharm: true })
    expect(r.elements).toEqual([{ kind: 'element', type: 'Poison', shownBase: 470, efeShown: expect.closeTo(528.75, 6) }])
  })

  it('Attack Up (L) song on a Hunting Horn with the same numbers: 452.9448', () => {
    const r = calc(horn({ element: { type: 'Poison', value: 470 } }), skills, { powercharm: true, songAttackL: true })
    expect(r.rawBeforeSong).toBe(266)
    expect(r.efrTrue).toBeCloseTo(452.9448, 4)
    expect(r.elements[0].efeShown).toBeCloseTo(528.75, 6)
  })

  it('songs apply only to a Hunting Horn', () => {
    const songs = { songAttackS: true, songAttackL: true, songAffinity: true, songElement: true }
    expect(calc(real(5014), skills, { powercharm: true, ...songs }).efrTrue).toBeCloseTo(377.454, 6)
  })

  it('song rules: Attack Up S and L do not stack; Affinity Up adds 20; Element Up multiplies', () => {
    const h = horn({ element: { type: 'Poison', value: 470 } })
    expect(calc(h, {}, { songAttackS: true }).efrTrue).toBeCloseTo(240 * 1.15 * 1.32 * 1.075, 6)
    expect(calc(h, {}, { songAttackS: true, songAttackL: true }).efrTrue).toBeCloseTo(240 * 1.2 * 1.32 * 1.075, 6)
    const aff = calc(h, {}, { songAffinity: true })
    expect(aff.affinity).toBe(50)
    expect(aff.critFactor).toBeCloseTo(1.125, 10)
    expect(calc(h, {}, { songElement: true }).elements[0].efeShown).toBeCloseTo(470 * 1.2 * 1.125, 6)
  })

  it('Insect Glaive kinsect: triple is +25% before the flats', () => {
    const ig = mkWeapon(2, 0, { class: 'Insect Glaive', attack: 744, affinity: 0, sharpness: WHITE })
    const all = { kinsectRed: true, kinsectWhite: true, kinsectOrange: true }
    expect(calc(ig, skills, { powercharm: true, ...all }).rawBeforeSong).toBe(326) // 240 * 1.25 + 20 + 6
    expect(calc(ig, skills, { powercharm: true, kinsectRed: true, kinsectWhite: true }).rawBeforeSong).toBe(314) // 240 * 1.2 + 26
    expect(calc(ig, skills, { powercharm: true, kinsectRed: true, kinsectOrange: true }).rawBeforeSong).toBe(266)
    expect(calc(ig, skills, { powercharm: true, kinsectWhite: true, kinsectOrange: true }).rawBeforeSong).toBe(266)
    expect(calc(real(5014), skills, { powercharm: true, ...all }).rawBeforeSong).toBe(266) // not a glaive
  })

  it('flat groups: Attack and Edgemaster share one group; Powertalon and Challenger add', () => {
    const gs = real(5014)
    expect(calc(gs, { 31: 20, 2: 10 }).rawBeforeSong).toBe(260) // +20, not +40
    expect(calc(gs, { 31: -10, 2: 10 }).rawBeforeSong).toBe(250) // -10 + 20
    expect(calc(gs, { 31: 25 }).rawBeforeSong).toBe(265)
    expect(calc(gs, { 31: 12 }).rawBeforeSong).toBe(250) // tier 10
    expect(calc(gs, { 31: -12 }).rawBeforeSong).toBe(230) // tier -10
    expect(calc(gs, { 31: 5 }).rawBeforeSong).toBe(240)
    expect(calc(gs, {}, { powertalon: true, powercharm: true }).rawBeforeSong).toBe(255)
    expect(calc(gs, { 26: 10 }, { raged: true }).rawBeforeSong).toBe(250)
    expect(calc(gs, { 26: 15 }, { raged: true }).rawBeforeSong).toBe(265)
    expect(calc(gs, { 26: 15 }, { raged: false }).rawBeforeSong).toBe(240)
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
    expect(calc(w, { 37: 10, 26: 15 }, { raged: true }).affinity).toBe(30)
    expect(calc(w, { 37: 10, 26: 15 }, { raged: false }).affinity).toBe(10)
    expect(calc(horn({ affinity: 0 }), { 37: 10, 26: 15 }, { raged: true, songAffinity: true }).affinity).toBe(50)
  })

  it('is clamped to [-100, 100]', () => {
    expect(calc(mkWeapon(1, 0, { affinity: 90, sharpness: WHITE }), { 37: 30 }).affinity).toBe(100)
    expect(calc(mkWeapon(1, 0, { affinity: -90, sharpness: WHITE }), { 37: -20 }).critFactor).toBeCloseTo(0.75, 10)
  })
})

describe('element', () => {
  const fire = (over: Partial<Weapon> = {}) => mkWeapon(1, 0, { affinity: 0, sharpness: GREEN, element: { type: 'Fire', value: 300 }, ...over })

  it('(Ele) Atk tiers; Element Atk Up stacks as a multiplier', () => {
    expect(calc(fire(), { 79: 15 }).elements[0].efeShown).toBeCloseTo(390, 6) // 300 * 1.10 + 60
    expect(calc(fire(), { 79: 10 }).elements[0].efeShown).toBeCloseTo(355, 6)
    expect(calc(fire(), { 79: 20 }).elements[0].efeShown).toBeCloseTo(435, 6)
    expect(calc(fire(), { 79: 15, 84: 10 }).elements[0].efeShown).toBeCloseTo(423, 6) // 300 * 1.10 * 1.10 + 60
  })

  it('negative tiers are exact inverses', () => {
    expect(calc(fire(), { 84: -10 }).elements[0].efeShown).toBeCloseTo(300 / 1.1, 6)
    expect(calc(fire(), { 79: -10 }).elements[0].efeShown).toBeCloseTo(300 / 1.05 - 40, 6)
    expect(calc(fire({ element: { type: 'Fire', value: 40 } }), { 79: -10 }).elements[0].efeShown).toBe(0) // floored
  })

  it('percent group: best positive wins, a negative cancels', () => {
    expect(calc(fire(), { 84: 10, 14: 10, 140: 10 }).elements[0].efeShown).toBeCloseTo(330, 6)
    expect(calc(fire(), { 14: 10, 84: -10 }).elements[0].efeShown).toBeCloseTo(300, 6)
  })

  it('an (Ele) Atk tree applies only to its own type; element and element2 are separate instances', () => {
    const dual = fire({ element2: { type: 'Ice', value: 100 } })
    const r = calc(dual, { 79: 15, 82: 10 })
    expect(r.elements.map((e) => [e.kind, e.type, Math.round(e.efeShown * 1000) / 1000])).toEqual([
      ['element', 'Fire', 390],
      ['element2', 'Ice', 145],
    ])
    expect(calc(fire({ element: { type: 'Water', value: 300 } }), { 79: 15 }).elements[0].efeShown).toBeCloseTo(300, 6)
    expect(calc(fire({ element: { type: 'Poison', value: 300 } }), { 79: 15 }).elements[0].efeShown).toBeCloseTo(300, 6)
  })

  it('an awaken element counts only with Awaken or Enlightened Blade', () => {
    const aw = mkWeapon(1, 0, { affinity: 0, sharpness: GREEN, awaken: { type: 'Ice', value: 410 } })
    const none = calc(aw, {})
    expect(none.elements).toEqual([])
    expect(none.awakenLocked).toBe(true)
    const on = calc(aw, { 17: 10 })
    expect(on.elements).toMatchObject([{ kind: 'awaken', type: 'Ice', shownBase: 410 }])
    expect(on.elements[0].efeShown).toBeCloseTo(410, 6)
    expect(on.awakenLocked).toBe(false)
    expect(calc(aw, { 140: 10 }).elements[0].efeShown).toBeCloseTo(410 * 1.1, 6) // Arcana also adds +10%
    expect(calc(aw, { 17: 9 }).elements).toEqual([])
    expect(calc(real(5014), {}).awakenLocked).toBe(false)
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
    expect(calc(h, {}, {}, 2).sharpness.selected).toBe(2)
    expect(calc(h, {}, {}, 2).efrTrue / calc(h).efrTrue).toBeCloseTo(1.0 / 1.32, 10)
    expect(calc(h, {}, {}, 6).sharpness.selected).toBe(5) // purple has no points on the base bar
    expect(calc(h, { 19: 10 }, {}, 6).sharpness.selected).toBe(6)
    expect(calc(h, {}, {}, 99).sharpness.selected).toBe(5)
    expect(calc(h, {}, {}, -1).sharpness.selected).toBe(5)
  })
})

describe('unavailable results and flags', () => {
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

describe('parseToggles', () => {
  it('defaults: items off, the rest on', () => {
    expect(DEFAULT_TOGGLES).toMatchObject({ powercharm: false, powertalon: false, raged: true, songAttackL: true, kinsectOrange: true })
    expect(parseToggles(undefined)).toEqual(DEFAULT_TOGGLES)
  })

  it('treats stored data as untrusted', () => {
    for (const junk of [null, 5, 'x', [], [true], { powercharm: 'yes', raged: 1, songElement: null }]) {
      expect(parseToggles(junk)).toEqual(DEFAULT_TOGGLES)
    }
    expect(parseToggles({ powercharm: true, raged: false, extra: true, __proto__: { songAttackS: false } })).toEqual({
      ...DEFAULT_TOGGLES,
      powercharm: true,
      raged: false,
    })
    expect(Object.keys(parseToggles({ evil: true }))).toEqual(Object.keys(DEFAULT_TOGGLES))
  })
})

describe('damage table against the skills data', () => {
  const trees = new Map(data.skills.map((t) => [t.id, t]))
  it('every tree id and tier threshold exists in skills.json', () => {
    const table = tableThresholds()
    expect(table.size).toBeGreaterThan(10)
    for (const [id, thresholds] of table) {
      const tree = trees.get(id)
      expect(tree, `tree ${id}`).toBeDefined()
      const have = new Set(tree?.tiers.map((t) => t.points))
      for (const t of thresholds) expect(have.has(t), `tree ${id} (${tree?.name}) has no tier at ${t}`).toBe(true)
    }
  })

  it('(Ele) Atk trees have the expected names', () => {
    expect(Object.fromEntries(Object.keys(ELEMENT_ATK_TREES).map((id) => [id, trees.get(Number(id))?.name]))).toEqual({
      79: 'Fire Atk',
      80: 'Water Atk',
      81: 'ThunderAtk',
      82: 'Ice Atk',
      83: 'Dragon Atk',
    })
  })

  it('the skills the table names are the ones the owner meant', () => {
    const names = Object.fromEntries([31, 2, 26, 37, 10, 84, 14, 140, 17, 19, 29].map((id) => [id, trees.get(id)?.name]))
    expect(names).toEqual({
      31: 'Attack', 2: 'Edgemaster', 26: 'Spirit', 37: 'Expert', 10: 'Brutality', 84: 'Elemental',
      14: 'Amplify', 140: 'Arcana', 17: 'FreeElemnt', 19: 'Handicraft', 29: 'Tenderizer',
    })
  })
})
