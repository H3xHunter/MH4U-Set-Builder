import { describe, expect, it } from 'vitest'
import type { SkillTree } from '@/data/types'
import { applyAction, emptyBuild, type Action, type BuildContext } from './build'
import { deriveBuild } from './derive'
import type { SavedCharm } from '@/data/types'
import { mkArmor, mkData, mkDeco, mkWeapon } from './fixtures'

const trees: SkillTree[] = [{ id: 1, name: 'T', tiers: [{ points: 5, name: 'T5', description: null }] }]
const charms: SavedCharm[] = [{ id: 'c', name: 'c', slots: 1, skills: { '1': 2 } }]
const ctx: BuildContext = {
  data: mkData({
    skills: trees,
    armor: [
      mkArmor(1, 'head', 1, { defense: 10, maxDefense: 50, res: { fire: 1, water: 2, thunder: 3, ice: 4, dragon: 5 }, skills: { '1': 2 } }),
      mkArmor(2, 'chest', 2, { defense: 20, maxDefense: null, res: { fire: -1, water: 0, thunder: 0, ice: 0, dragon: -5 } }),
      mkArmor(3, 'legs', 0, { defense: 5, maxDefense: 30, torsoUp: true }),
    ],
    decorations: [mkDeco(10, 1, { '1': 1 })],
    weapons: [mkWeapon(100, 2, { defenseBonus: 7 }), mkWeapon(101, 0)],
  }),
  charms,
}
const build = (actions: Action[]) => actions.reduce((s, a) => applyAction(s, a, ctx), emptyBuild())
const worn = [
  { type: 'setArmor', slot: 'head', armorId: 1 },
  { type: 'setArmor', slot: 'chest', armorId: 2 },
] as const

describe('deriveBuild', () => {
  it('empty build', () => {
    const d = deriveBuild(emptyBuild(), ctx)
    expect(d).toMatchObject({ weapon: null, skills: [], armorDefense: 0, totalDefense: 0, maxDefenseFallbackCount: 0 })
    expect(d.slotUsage.weapon).toEqual({ used: 0, free: 0, ok: true })
  })

  it('defense at normal level, with and without a weapon bonus', () => {
    const d = deriveBuild(build([...worn]), ctx)
    expect(d).toMatchObject({ armorDefense: 30, weaponDefenseBonus: 0, totalDefense: 30, maxDefenseFallbackCount: 0 })
    const w = deriveBuild(build([...worn, { type: 'setWeapon', weapon: { kind: 'data', weaponId: 100 } }]), ctx)
    expect(w).toMatchObject({ armorDefense: 30, weaponDefenseBonus: 7, totalDefense: 37 })
  })

  it('defense at max level, null maxDefense falls back to defense and is counted', () => {
    const s = build([...worn, { type: 'setArmorLevel', level: 'max' }, { type: 'setWeapon', weapon: { kind: 'data', weaponId: 100 } }])
    expect(deriveBuild(s, ctx)).toMatchObject({ armorDefense: 70, totalDefense: 77, maxDefenseFallbackCount: 1 })
  })

  it('treats a null weapon defenseBonus as 0', () => {
    const c = { ...ctx, data: mkData({ weapons: [mkWeapon(1, 0, { defenseBonus: null as unknown as number })] }) }
    const s = applyAction(emptyBuild(), { type: 'setWeapon', weapon: { kind: 'data', weaponId: 1 } }, c)
    expect(deriveBuild(s, c).weaponDefenseBonus).toBe(0)
  })

  it('sums resistances over worn pieces', () => {
    expect(deriveBuild(build([...worn]), ctx).resistances).toEqual({ fire: 0, water: 2, thunder: 3, ice: 4, dragon: 0 })
  })

  it('slot usage per target and a custom-slots weapon', () => {
    const s = build([
      ...worn,
      { type: 'addDeco', target: { kind: 'armor', slot: 'chest' }, decoId: 10 },
      { type: 'setWeapon', weapon: { kind: 'slots', slots: 2 } },
      { type: 'addDeco', target: { kind: 'weapon' }, decoId: 10 },
    ])
    const u = deriveBuild(s, ctx).slotUsage
    expect(u.armor.chest).toEqual({ used: 1, free: 1, ok: true })
    expect(u.armor.head).toEqual({ used: 0, free: 1, ok: true })
    expect(u.armor.legs).toEqual({ used: 0, free: 0, ok: true })
    expect(u.weapon).toEqual({ used: 1, free: 1, ok: true })
    expect(deriveBuild(s, ctx).weapon).toBeNull()
  })

  it('assembles skill input: charm, decorations and Torso Up', () => {
    const s = build([
      ...worn,
      { type: 'setArmor', slot: 'legs', armorId: 3 },
      { type: 'setCharm', charmId: 'c' },
      { type: 'addDeco', target: { kind: 'armor', slot: 'head' }, decoId: 10 },
      { type: 'addDeco', target: { kind: 'armor', slot: 'chest' }, decoId: 10 },
    ])
    // chest has no skill points of its own, so Torso Up copies only its decoration
    expect(deriveBuild(s, ctx).skills).toEqual([
      expect.objectContaining({ treeId: 1, armor: 2, charm: 2, base: 4, deco: 2, torsoUpDeco: 1, total: 7 }),
    ])
    expect(deriveBuild(s, ctx).skills[0].totalTier).toEqual({ points: 5, name: 'T5' })
    expect(deriveBuild(s, ctx).skills[0].baseTier).toBeNull()
  })

  it('a stale charm id derives as no charm', () => {
    const s = build([{ type: 'setCharm', charmId: 'gone' }])
    expect(deriveBuild(s, ctx).skillInput.charm).toBeNull()
  })
})
