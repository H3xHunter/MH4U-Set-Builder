import { describe, expect, it } from 'vitest'
import { loadRealData } from '@/data/real-data-fixture'
import type { SkillTree } from '@/data/types'
import { applyAction, emptyBuild, type Action, type BuildContext } from '@/state/build'
import { deriveBuild } from '@/state/derive'
import { mkArmor, mkData, mkDeco } from '@/state/fixtures'
import {
  DEFENSE_BY_THRESHOLD,
  DEFENSE_TREE_ID,
  RESISTANCE_BY_THRESHOLD,
  RESISTANCE_TREES,
  skillEffects,
} from './skillEffects'
import { activeTier, type SkillRow } from './skills'

describe('tables against the real data', () => {
  const data = loadRealData()
  const tree = (id: number) => data.skills.find((t) => t.id === id)

  it('the Defense tree exists with that name and every table threshold is a tier', () => {
    const t = tree(DEFENSE_TREE_ID)!
    expect(t.name).toBe('Defense')
    expect(t.tiers.map((x) => x.points).sort((a, b) => a - b)).toEqual(Object.keys(DEFENSE_BY_THRESHOLD).map(Number).sort((a, b) => a - b))
  })

  it.each(Object.entries(RESISTANCE_TREES))('%s Res tree: id, name and thresholds match', (_element, { id, name }) => {
    const t = tree(id)!
    expect(t?.name).toBe(name)
    for (const threshold of Object.keys(RESISTANCE_BY_THRESHOLD).map(Number)) {
      expect(t.tiers.some((x) => x.points === threshold), `${name} has a tier at ${threshold}`).toBe(true)
    }
    // Every tier of the tree has a table entry, so a data change cannot silently produce a table miss.
    for (const x of t.tiers) expect(RESISTANCE_BY_THRESHOLD[x.points], `${name} tier ${x.points}`).toBeDefined()
  })

  it('the named tier labels line up with the values (a sanity read of the data)', () => {
    expect(tree(85)!.tiers.map((t) => [t.points, t.name])).toEqual([
      [-10, 'Fire Res -20'],
      [10, 'Fire Res +15'],
      [15, 'Fire Res +20'],
    ])
  })
})

describe('skillEffects (pure)', () => {
  const row = (treeId: number, total: number, tiers: SkillTree['tiers']): SkillRow => ({
    treeId, armor: total, charm: 0, torsoUpBase: 0, deco: 0, torsoUpDeco: 0, base: total, total,
    baseTier: activeTier(tiers, total), totalTier: activeTier(tiers, total),
  })
  const t = (...p: number[]): SkillTree['tiers'] => p.map((points) => ({ points, name: String(points), description: null }))

  it('a table miss contributes 0 and is recorded, never thrown', () => {
    const e = skillEffects([row(32, 12, t(12))]) // threshold 12 is not in the table
    expect(e.defense).toBe(0)
    expect(e.issues).toEqual([{ treeId: 32, threshold: 12 }])
  })

  it('ignores other skills (Def Lock, Status Res, ...) and skills with no active tier', () => {
    const e = skillEffects([row(62, 10, t(10)), row(4, 10, t(10)), row(32, 5, t(10))])
    expect(e).toEqual({ defense: 0, resistances: { fire: 0, water: 0, thunder: 0, ice: 0, dragon: 0 }, issues: [] })
  })
})

describe('deriveBuild with skill effects', () => {
  const tiersOf = (id: number, name: string, points: number[]): SkillTree => ({
    id, name, tiers: points.map((p) => ({ points: p, name: `${name} ${p}`, description: null })),
  })
  const trees: SkillTree[] = [
    tiersOf(32, 'Defense', [-20, -15, -10, 10, 15, 20, 25]),
    tiersOf(85, 'Fire Res', [-10, 10, 15]),
    tiersOf(86, 'Water Res', [-10, 10, 15]),
  ]
  const res = { fire: 1, water: 2, thunder: 3, ice: 4, dragon: 5 }
  const piece = (id: number, slot: 'head' | 'chest' | 'arms' | 'waist' | 'legs', skills: Record<string, number>, extra = {}) =>
    mkArmor(id, slot, 3, { defense: 10, maxDefense: 100, res, skills, ...extra })
  const ctx = (armor: ReturnType<typeof piece>[], decos = [mkDeco(10, 1, { '32': 5 }), mkDeco(11, 1, { '85': 2 })]): BuildContext => ({
    data: mkData({ skills: trees, armor, decorations: decos }),
    charms: [],
  })
  const run = (c: BuildContext, actions: Action[]) => deriveBuild(actions.reduce((s, a) => applyAction(s, a, c), emptyBuild()), c)
  const wear = (id: number, slot: 'head' | 'chest' | 'arms' | 'waist' | 'legs'): Action => ({ type: 'setArmor', slot, armorId: id })

  it('Defense +20 tier adds 20 at Normal and at Max', () => {
    const c = ctx([piece(1, 'head', { '32': 20 })])
    const normal = run(c, [wear(1, 'head')])
    expect(normal).toMatchObject({ armorDefense: 10, skillDefense: 20, totalDefense: 30 })
    const max = run(c, [wear(1, 'head'), { type: 'setArmorLevel', level: 'max' }])
    expect(max).toMatchObject({ armorDefense: 100, skillDefense: 20, totalDefense: 120 })
  })

  it('Defense Down (-10) subtracts', () => {
    const d = run(ctx([piece(1, 'head', { '32': -10 })]), [wear(1, 'head')])
    expect(d).toMatchObject({ skillDefense: -10, totalDefense: 0 })
  })

  it('points between tiers use the lower tier (12 points is the +10 tier)', () => {
    expect(run(ctx([piece(1, 'head', { '32': 12 })]), [wear(1, 'head')]).skillDefense).toBe(10)
    expect(run(ctx([piece(1, 'head', { '32': 9 })]), [wear(1, 'head')]).skillDefense).toBe(0)
  })

  it('element Res: the tier, not the points, is the resistance, and it adds to the armor value', () => {
    const at = (points: number) => run(ctx([piece(1, 'head', { '85': points })]), [wear(1, 'head')])
    expect(at(10).skillResistances.fire).toBe(15)
    expect(at(10).totalResistances.fire).toBe(1 + 15)
    expect(at(15).skillResistances.fire).toBe(20)
    expect(at(20).skillResistances.fire).toBe(20) // past the top tier stays at the top tier
    expect(at(-10).skillResistances.fire).toBe(-20)
    expect(at(-10).totalResistances.fire).toBe(1 - 20)
    expect(at(10).resistances.fire).toBe(1) // armor-only field unchanged
    expect(at(10).skillResistances.water).toBe(0)
  })

  it('decoration points count through the total tier', () => {
    // armor gives 8 Defense points, one +5 Defense deco makes 13 -> the +10 tier
    const c = ctx([piece(1, 'head', { '32': 8 })])
    const d = run(c, [wear(1, 'head'), { type: 'addDeco', target: { kind: 'armor', slot: 'head' }, decoId: 10 }])
    expect(d.skills.find((s) => s.treeId === 32)).toMatchObject({ base: 8, total: 13 })
    expect(d.skillDefense).toBe(10)
  })

  it('Torso Up points count through the total tier', () => {
    // chest Defense 6 + two Torso Up pieces (+2x6) -> 18 -> tier 15
    const c = ctx([
      piece(1, 'chest', { '32': 6 }),
      piece(2, 'arms', {}, { torsoUp: true }),
      piece(3, 'waist', {}, { torsoUp: true }),
    ])
    const d = run(c, [wear(1, 'chest'), wear(2, 'arms'), wear(3, 'waist')])
    expect(d.skills.find((s) => s.treeId === 32)).toMatchObject({ torsoUpBase: 12, total: 18 })
    expect(d.skillDefense).toBe(15)
  })

  it('a table miss in a build yields 0 plus an issue', () => {
    const odd: SkillTree = tiersOf(32, 'Defense', [12])
    const c: BuildContext = { data: mkData({ skills: [odd], armor: [piece(1, 'head', { '32': 12 })] }), charms: [] }
    const d = run(c, [wear(1, 'head')])
    expect(d.skillDefense).toBe(0)
    expect(d.effectIssues).toEqual([{ treeId: 32, threshold: 12 }])
  })

  it('builds without these skills are unchanged', () => {
    const d = run(ctx([piece(1, 'head', {})]), [wear(1, 'head')])
    expect(d).toMatchObject({ skillDefense: 0, totalDefense: 10, effectIssues: [] })
    expect(d.totalResistances).toEqual(res)
  })
})
