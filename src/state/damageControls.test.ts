import { describe, expect, it } from 'vitest'
import type { SkillTree, Weapon } from '@/data/types'
import { DEFAULT_TOGGLES } from '@/lib/damage'
import { applyAction, emptyBuild, type BuildContext } from './build'
import {
  chooseSharpness,
  clearSharpness,
  computeDamage,
  INITIAL_CONTROLS,
  resetToggles,
  resolveToggles,
  setToggle,
  sharpnessFor,
  type DamageControls,
} from './damageControls'
import { deriveBuild } from './derive'
import { mkArmor, mkData, mkWeapon } from './fixtures'

const tree = (id: number, name: string, tiers: [number, string][]): SkillTree => ({
  id,
  name,
  tiers: tiers.map(([points, n]) => ({ points, name: n, description: null })),
})
const trees = [
  tree(31, 'Attack', [[-20, 'Attack Down (L)'], [10, 'Attack Up (S)'], [20, 'Attack Up (L)']]),
  tree(19, 'Handicraft', [[10, 'Sharpness +1']]),
  tree(26, 'Spirit', [[10, 'Challenger +1'], [15, 'Challenger +2']]),
  tree(29, 'Tenderizer', [[10, 'Weakness Exploit']]),
  tree(17, 'FreeElemnt', [[10, 'Awaken']]),
]

const WHITE = { base: [0, 0, 0, 0, 0, 1, 0], plus: [0, 0, 0, 0, 0, 1, 0] } as Weapon['sharpness']
const MANY = { base: [1, 1, 1, 1, 1, 1, 0], plus: [1, 1, 1, 1, 1, 1, 1] } as Weapon['sharpness']
const weapons = [
  mkWeapon(100, 0, { attack: 1152, affinity: 30, sharpness: WHITE }), // Great Sword, true raw 240
  mkWeapon(101, 0, { attack: 1152, affinity: 0, sharpness: MANY }),
  mkWeapon(108, 0, { attack: 1152, affinity: 0, sharpness: MANY }),
  mkWeapon(102, 0, { class: 'Hunting Horn', attack: 1248, affinity: 0, sharpness: WHITE }),
  mkWeapon(103, 0, { class: 'Insect Glaive', attack: 744, affinity: 0, sharpness: WHITE }),
  mkWeapon(104, 0, { class: 'Bow', attack: 120 }),
  mkWeapon(105, 0, { attack: 1152, affinity: 0, sharpness: WHITE, element: { type: 'Poison', value: 470 } }),
  mkWeapon(106, 0, { attack: 1152, affinity: 0, sharpness: WHITE, awaken: { type: 'Ice', value: 410 } }),
  mkWeapon(107, 0, { attack: 1152, affinityOptions: [-45, 20], affinity: null, sharpness: WHITE }),
]
const ARMORS = {
  attackL: mkArmor(1, 'head', 0, { skills: { '31': 20 } }),
  attackHandicraft: mkArmor(2, 'head', 0, { skills: { '31': 20, '19': 10 } }),
  challenger: mkArmor(3, 'head', 0, { skills: { '26': 15 } }),
  tenderizer: mkArmor(4, 'head', 0, { skills: { '29': 10 } }),
  awaken: mkArmor(5, 'head', 0, { skills: { '17': 10 } }),
}
const ctx: BuildContext = { data: mkData({ skills: trees, armor: Object.values(ARMORS), weapons }), charms: [] }

const derive = (weaponId: number, armor?: keyof typeof ARMORS) => {
  let s = applyAction(emptyBuild(), { type: 'setWeapon', weapon: { kind: 'data', weaponId } }, ctx)
  if (armor) s = applyAction(s, { type: 'setArmor', slot: 'head', armorId: ARMORS[armor].id }, ctx)
  return deriveBuild(s, ctx)
}
const view = (weaponId: number, armor?: keyof typeof ARMORS, controls: DamageControls = INITIAL_CONTROLS) =>
  computeDamage(derive(weaponId, armor), trees, controls)
const efr = (v: ReturnType<typeof view>) => (v.result?.ok ? v.result.efrTrue : NaN)

describe('controls', () => {
  it('overrides are kept only while they differ from the default; unknown ids are ignored', () => {
    const c = setToggle(INITIAL_CONTROLS, 'item:powercharm', false)
    expect(c.overrides).toEqual({ 'item:powercharm': false })
    expect(setToggle(c, 'item:powercharm', true).overrides).toEqual({})
    expect(setToggle(INITIAL_CONTROLS, 'nope', true)).toBe(INITIAL_CONTROLS)
    expect(resolveToggles(c)).toEqual({ ...DEFAULT_TOGGLES, 'item:powercharm': false })
  })

  it('Reset buffs returns every toggle to its default and keeps the chosen color', () => {
    let c = setToggle(INITIAL_CONTROLS, 'item:powercharm', false)
    c = setToggle(c, 'skill:attack', false)
    c = chooseSharpness(c, 101, 2)
    const r = resetToggles(c)
    expect(resolveToggles(r)).toEqual(DEFAULT_TOGGLES)
    expect(r.sharpness).toEqual({ weaponId: 101, color: 2 })
    expect(efr(view(100, 'attackL', r))).toBe(efr(view(100, 'attackL')))
  })

  it('the chosen color belongs to one weapon', () => {
    const c = chooseSharpness(INITIAL_CONTROLS, 101, 2)
    expect(sharpnessFor(c, 101)).toBe(2)
    expect(sharpnessFor(c, 108)).toBeUndefined()
    expect(sharpnessFor(c, null)).toBeUndefined()
    expect(sharpnessFor(clearSharpness(c), 101)).toBeUndefined()
  })
})

describe('toggling changes the result (Great Sword 100: true raw 240, +30% affinity, white)', () => {
  it('defaults: Powercharm and Powertalon on, Attack Up (L): raw 240 + 20 + 6 + 9', () => {
    const v = view(100, 'attackL')
    expect(v.result).toMatchObject({ ok: true, rawBeforeSong: 275 })
    expect(efr(v)).toBeCloseTo(275 * 1.32 * 1.075, 6)
  })

  it('Powertalon off gives 266 and EFR 377.454; Powercharm off too gives 260', () => {
    const c1 = setToggle(INITIAL_CONTROLS, 'item:powertalon', false)
    expect(efr(view(100, 'attackL', c1))).toBeCloseTo(377.454, 6)
    const c2 = setToggle(c1, 'item:powercharm', false)
    expect(view(100, 'attackL', c2).result).toMatchObject({ rawBeforeSong: 260 })
  })

  it('a skill switched off removes its effect (the build itself is unchanged)', () => {
    const d = derive(100, 'attackL')
    const off = computeDamage(d, trees, setToggle(INITIAL_CONTROLS, 'skill:attack', false))
    expect(off.result).toMatchObject({ rawBeforeSong: 255 })
    expect(d.skills.find((r) => r.treeId === 31)?.total).toBe(20)
  })

  it('Tenderizer off removes the weakness-exploit flag', () => {
    expect(view(100, 'tenderizer').result).toMatchObject({ weaknessExploit: true })
    expect(view(100, 'tenderizer', setToggle(INITIAL_CONTROLS, 'skill:tenderizer', false)).result).toMatchObject({ weaknessExploit: false })
  })

  it('Awaken off locks the awaken element', () => {
    expect(view(106, 'awaken').result).toMatchObject({ awakenLocked: false, instances: [{ type: 'Ice' }] })
    expect(view(106, 'awaken', setToggle(INITIAL_CONTROLS, 'skill:awaken', false)).result).toMatchObject({ awakenLocked: true, instances: [] })
  })
})

describe('sharpness selection', () => {
  it('a chosen color changes the value; the default is the top color of the bar', () => {
    const top = view(101)
    expect(top.result).toMatchObject({ sharpness: { bar: 'base', selected: 5, selectable: [0, 1, 2, 3, 4, 5] } })
    const yellow = view(101, undefined, chooseSharpness(INITIAL_CONTROLS, 101, 2))
    expect(yellow.result).toMatchObject({ sharpness: { selected: 2 } })
    expect(efr(yellow) / efr(top)).toBeCloseTo(1 / 1.32, 10)
  })

  it('resets to the top color when the weapon changes', () => {
    const c = chooseSharpness(INITIAL_CONTROLS, 101, 2)
    expect(view(101, undefined, c).result).toMatchObject({ sharpness: { selected: 2 } })
    expect(view(108, undefined, c).result).toMatchObject({ sharpness: { selected: 5 } })
  })

  it('Handicraft off falls back to the base bar and clears a color the base bar does not have', () => {
    const on = view(101, 'attackHandicraft')
    expect(on.result).toMatchObject({ sharpness: { bar: 'plus', selected: 6 } })
    const chosen = chooseSharpness(INITIAL_CONTROLS, 101, 6)
    expect(view(101, 'attackHandicraft', chosen).controls).toBe(chosen) // valid on the plus bar: kept
    const off = view(101, 'attackHandicraft', setToggle(chosen, 'skill:handicraft', false))
    expect(off.result).toMatchObject({ sharpness: { bar: 'base', selected: 5 } })
    expect(off.controls.sharpness).toBeNull()
    expect(off.sharpnessColor).toBe(6)
    const back = view(101, 'attackHandicraft', off.controls)
    expect(back.sharpnessColor).toBeUndefined()
  })
})

describe('what the cards list', () => {
  const sources = (v: ReturnType<typeof view>) => v.groups.map((g) => g.source)

  it('Great Sword: the skills of the build (named by their tier) and the items', () => {
    expect(sources(view(100))).toEqual(['item'])
    const v = view(100, 'attackL')
    expect(sources(v)).toEqual(['skill', 'item'])
    expect(v.groups[0].buffs).toEqual([{ id: 'skill:attack', label: 'Attack Up (L)', condition: null, default: true }])
    expect(v.groups[1].buffs.map((b) => [b.id, b.default])).toEqual([['item:powercharm', true], ['item:powertalon', true]])
  })

  it('a conditional skill carries its condition', () => {
    expect(view(100, 'challenger').groups[0].buffs).toEqual([{ id: 'skill:challenger', label: 'Challenger +2', condition: 'raged monster', default: true }])
  })

  it('Hunting Horn: songs', () => {
    const v = view(102)
    expect(sources(v)).toEqual(['item', 'song'])
    expect(v.groups[1].buffs.map((b) => b.label)).toEqual(['Attack Up (S)', 'Attack Up (L)', 'Affinity Up', 'Element Up'])
    expect(view(100).groups.some((g) => g.source === 'song')).toBe(false)
  })

  it('Insect Glaive: kinsect toggles and the active combination', () => {
    const v = view(103)
    expect(sources(v)).toEqual(['item', 'kinsect'])
    expect(v.kinsect).toEqual({ label: 'Triple Up', percent: 25 })
    const noOrange = view(103, undefined, setToggle(INITIAL_CONTROLS, 'kinsect:orange', false))
    expect(noOrange.kinsect).toEqual({ label: 'Red + White', percent: 20 })
    const noRed = setToggle(setToggle(INITIAL_CONTROLS, 'kinsect:orange', false), 'kinsect:red', false)
    expect(view(103, undefined, noRed).kinsect).toBeNull()
    expect(view(100).kinsect).toBeNull()
  })

  it('no weapon: nothing; gunner: unavailable result but the items are still listed', () => {
    const none = computeDamage(deriveBuild(emptyBuild(), ctx), trees, INITIAL_CONTROLS)
    expect(none).toMatchObject({ weapon: null, result: null, groups: [] })
    const bow = view(104)
    expect(bow.result).toMatchObject({ ok: false })
    expect(sources(bow)).toEqual(['item'])
  })
})

describe('instances', () => {
  it('a status weapon gives a status instance', () => {
    expect(view(105).result).toMatchObject({ ok: true, instances: [{ kind: 'status', type: 'Poison', effectiveShown: 470 }] })
  })
  it('double affinity averages', () => {
    expect(view(107).result).toMatchObject({ affinity: -12.5 })
  })
})
