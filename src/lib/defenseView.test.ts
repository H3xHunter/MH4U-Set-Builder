import { describe, expect, it } from 'vitest'
import { loadRealData } from '@/data/real-data-fixture'
import { applyAction, emptyBuild, type Action, type BuildContext } from '@/state/build'
import { deriveBuild } from '@/state/derive'
import { mkArmor, mkData, mkWeapon } from '@/state/fixtures'
import { damageReduction, damageTaken, defenseView, formatPercent, formatSigned } from './defenseView'

describe('damageReduction', () => {
  it.each([
    [0, '0.0%'],
    [80, '50.0%'],
    [38, '32.2%'],
    [294, '78.6%'],
    [348, '81.3%'],
  ])('defense %i -> %s', (defense, text) => {
    expect(formatPercent(damageReduction(defense)!)).toBe(text)
  })

  it('is null when 80 + defense <= 0', () => {
    expect(damageReduction(-80)).toBeNull()
    expect(damageReduction(-100)).toBeNull()
    expect(damageReduction(-79)).not.toBeNull()
  })
})

describe('damageTaken', () => {
  it('is the complement of the reduction', () => {
    expect(formatPercent(damageTaken(0)!)).toBe('100.0%')
    expect(formatPercent(damageTaken(80)!)).toBe('50.0%')
    expect(formatPercent(damageTaken(348)!)).toBe('18.7%')
    expect(damageTaken(-80)).toBeNull()
  })
})

describe('formatSigned', () => {
  it('uses the real minus sign and a plus for positives', () => {
    expect(formatSigned(2)).toBe('+2')
    expect(formatSigned(-3)).toBe('−3')
    expect(formatSigned(0)).toBe('0')
  })
})

describe('defenseView on the verified real-data build (defense 38 / 348, weapon bonus 20)', () => {
  const ctx: BuildContext = { data: loadRealData(), charms: [] }
  const actions: Action[] = [
    { type: 'setArmor', slot: 'chest', armorId: 2021 },
    { type: 'setArmor', slot: 'legs', armorId: 1953 },
    { type: 'setArmor', slot: 'waist', armorId: 1993 },
    { type: 'setWeapon', weapon: { kind: 'data', weaponId: 5007 } },
  ]
  const normal = actions.reduce((s, a) => applyAction(s, a, ctx), emptyBuild())
  const max = applyAction(normal, { type: 'setArmorLevel', level: 'max' }, ctx)

  it('normal level', () => {
    const v = defenseView(deriveBuild(normal, ctx), 'normal')
    expect(v).toMatchObject({ total: 58, armor: 38, weaponBonus: 20, hasAnything: true, fallbackCount: 0 })
    expect(formatPercent(v.reduction!)).toBe('42.0%')
    expect(formatPercent(v.taken!)).toBe('58.0%')
    expect(v.resist.map((r) => [r.key, r.value])).toEqual([['fire', 0], ['water', -4], ['thunder', -3], ['ice', 2], ['dragon', -1]])
    expect(v.resist.map((r) => r.label)).toEqual(['Fire', 'Water', 'Thun.', 'Ice', 'Dragon'])
  })

  it('max level changes the total and the reduction', () => {
    const v = defenseView(deriveBuild(max, ctx), 'max')
    expect(v).toMatchObject({ total: 368, armor: 348, weaponBonus: 20 })
    expect(formatPercent(v.reduction!)).toBe('82.1%')
    expect(formatPercent(v.taken!)).toBe('17.9%')
  })
})

describe('defenseView edge cases', () => {
  const data = mkData({
    armor: [
      mkArmor(1, 'head', 0, { defense: 10, maxDefense: 50 }),
      mkArmor(2, 'chest', 0, { defense: 20, maxDefense: null }),
      mkArmor(3, 'arms', 0, { defense: 0, maxDefense: 0 }),
    ],
    weapons: [mkWeapon(100, 0, { defenseBonus: 7 }), mkWeapon(101, 0)],
  })
  const ctx: BuildContext = { data, charms: [] }
  const build = (...a: Action[]) => a.reduce((s, x) => applyAction(s, x, ctx), emptyBuild())

  it('empty build: nothing to show', () => {
    const v = defenseView(deriveBuild(emptyBuild(), ctx), 'normal')
    expect(v).toMatchObject({ hasAnything: false, reduction: null, taken: null, total: 0 })
  })

  it('a weapon bonus alone counts as something; a weapon without bonus does not', () => {
    expect(defenseView(deriveBuild(build({ type: 'setWeapon', weapon: { kind: 'data', weaponId: 100 } }), ctx), 'normal').hasAnything).toBe(true)
    expect(defenseView(deriveBuild(build({ type: 'setWeapon', weapon: { kind: 'data', weaponId: 101 } }), ctx), 'normal').hasAnything).toBe(false)
  })

  it('a worn piece with 0 defense still counts as equipped', () => {
    const v = defenseView(deriveBuild(build({ type: 'setArmor', slot: 'arms', armorId: 3 }), ctx), 'normal')
    expect(v.hasAnything).toBe(true)
    expect(formatPercent(v.reduction!)).toBe('0.0%')
  })

  it('fallback count only applies at max level', () => {
    const s = build({ type: 'setArmor', slot: 'chest', armorId: 2 }, { type: 'setArmor', slot: 'head', armorId: 1 })
    const max = applyAction(s, { type: 'setArmorLevel', level: 'max' }, ctx)
    expect(defenseView(deriveBuild(s, ctx), 'normal').fallbackCount).toBe(0)
    const v = defenseView(deriveBuild(max, ctx), 'max')
    expect(v.fallbackCount).toBe(1)
    expect(v.armor).toBe(70)
  })
})
