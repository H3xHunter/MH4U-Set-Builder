/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { validateGameData } from '@/data/validate'
import { DATA_FILES } from '@/data/load'
import { applyAction, emptyBuild, type Action, type BuildContext } from './build'
import { deriveBuild } from './derive'

const raw = Object.fromEntries(
  DATA_FILES.map((n) => [n, JSON.parse(readFileSync(new URL(`../../public/data/${n}.json`, import.meta.url), 'utf8'))]),
)
const ctx: BuildContext = {
  data: validateGameData(raw),
  charms: [{ id: 'c', name: 'Test charm', slots: 1, skills: { '118': 1 } }],
}

// Hand-computed from the data:
//   chest 2021 Ioprey Mail  (2 slots) skills 48:2 118:1 121:-2, def 15 / max 117, res f0 w-3 t-3 i2 d2
//   legs  1953 Alloy Greaves (Torso Up) def 8 / max 114,        res f-1 w1 t-2 i-1 d0
//   waist 1993 Remobra Belt  (Torso Up) def 15 / max 117,       res f1 w-2 t2 i1 d-3
//   deco  1573 Antidote Jewel 2 (size 2): 118:+3, 121:-1  (in the chest)
//   deco  1572 Antidote Jewel 1 (size 1): 118:+1, 121:-1  (on weapon 5007, 2 slots, defenseBonus 20)
//   charm 118:+1
describe('end to end on the real data', () => {
  const actions: Action[] = [
    { type: 'setArmor', slot: 'chest', armorId: 2021 },
    { type: 'setArmor', slot: 'legs', armorId: 1953 },
    { type: 'setArmor', slot: 'waist', armorId: 1993 },
    { type: 'addDeco', target: { kind: 'armor', slot: 'chest' }, decoId: 1573 },
    { type: 'setWeapon', weapon: { kind: 'data', weaponId: 5007 } },
    { type: 'addDeco', target: { kind: 'weapon' }, decoId: 1572 },
    { type: 'setCharm', charmId: 'c' },
  ]
  const state = actions.reduce((s, a) => applyAction(s, a, ctx), emptyBuild())
  const d = deriveBuild(state, ctx)

  it('keeps every decoration', () => {
    expect(state.armor.chest?.decos).toEqual([1573])
    expect(state.weaponDecos).toEqual([1572])
  })

  it('skills, with Torso Up from legs and waist (n = 2)', () => {
    expect(d.skills.map((r) => r.treeId)).toEqual([48, 118, 121])
    const [s48, s118, s121] = d.skills
    expect(s48).toMatchObject({ armor: 2, charm: 0, torsoUpBase: 4, deco: 0, torsoUpDeco: 0, base: 6, total: 6, baseTier: null, totalTier: null })
    // 118: base 1 + charm 1 + 2*1 = 4; deco 3 + 1 = 4, torsoUpDeco 2*3 = 6; total 14
    expect(s118).toMatchObject({ armor: 1, charm: 1, torsoUpBase: 2, deco: 4, torsoUpDeco: 6, base: 4, total: 14, baseTier: null })
    expect(s118.totalTier?.name).toBe('Negate Poison')
    // 121: base -2 + 2*-2 = -6; deco -1 + -1 = -2, torsoUpDeco 2*-1 = -2; total -10
    expect(s121).toMatchObject({ armor: -2, torsoUpBase: -4, deco: -2, torsoUpDeco: -2, base: -6, total: -10, baseTier: null })
    expect(s121.totalTier).toEqual({ points: -10, name: 'Double Stun' })
  })

  it('defense and resistances', () => {
    expect(d).toMatchObject({ armorDefense: 38, weaponDefenseBonus: 20, totalDefense: 58, maxDefenseFallbackCount: 0 })
    expect(d.resistances).toEqual({ fire: 0, water: -4, thunder: -3, ice: 2, dragon: -1 })
    const max = deriveBuild(applyAction(state, { type: 'setArmorLevel', level: 'max' }, ctx), ctx)
    expect(max).toMatchObject({ armorDefense: 348, totalDefense: 368 })
  })
})
