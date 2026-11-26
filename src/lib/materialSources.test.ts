/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DATA_FILES } from '@/data/load'
import type { GameData, Material } from '@/data/types'
import { validateGameData } from '@/data/validate'
import { mkData } from '@/state/fixtures'
import { byChance, formatChance, sourceView } from './materialSources'

const real = validateGameData(
  Object.fromEntries(DATA_FILES.map((n) => [n, JSON.parse(readFileSync(new URL(`../../public/data/${n}.json`, import.meta.url), 'utf8'))])),
)
const mat = (id: number) => {
  const m = real.materials.find((x) => x.id === id)
  if (!m) throw new Error(`material ${id}`)
  return m
}

describe('formatChance', () => {
  it('0 -> "0%", null -> "?", numbers as stored', () => {
    expect([formatChance(0), formatChance(null), formatChance(40), formatChance(12.5)]).toEqual(['0%', '?', '40%', '12.5%'])
  })
})

describe('sourceView on real data', () => {
  it('Ioprey Piel (416): Iodrome drops at G, 6 quest rewards, no gathering', () => {
    const v = sourceView(mat(416), real)
    expect(v.drops.map((d) => [d.monsterName, d.condition, d.percentage, d.rank, d.stackSize, d.count])).toEqual([
      ['Iodrome', 'Capture', 45, 'G', 2, 1],
      ['Iodrome', 'Body Carve', 40, 'G', 1, 1],
      ['Iodrome', 'Shiny Drop', 10, 'G', 1, 1],
    ])
    expect(v.gathering).toEqual([])
    expect(v.quests).toHaveLength(6)
    expect(v.quests.map((q) => q.percentage)).toEqual([45, 45, 45, 14, 13, 45].sort((a, b) => b - a))
    expect(v.quests[0]).toMatchObject({ hub: expect.any(String), stars: expect.any(Number), slot: expect.stringMatching(/^(A|B|Sub)$/) })
    expect(v.coverage).toBe('shown')
    expect(v.issues).toEqual([])
  })

  it('Machalite Ore (205): four identical Ancestral Steppe Area 7 Mine LR 9% rows collapse to x4; nothing is dropped', () => {
    const v = sourceView(mat(205), real)
    const row = v.gathering.find((g) => g.locationName === 'Ancestral Steppe' && g.area === 'Area 7' && g.rank === 'LR' && g.percentage === 9)
    expect(row).toMatchObject({ site: 'Mine', quantity: 1, count: 4 })
    expect(v.gathering.reduce((n, g) => n + g.count, 0)).toBe(mat(205).gathering.length)
    expect(v.drops.reduce((n, d) => n + d.count, 0)).toBe(mat(205).drops.length)
    expect(v.quests.reduce((n, q) => n + q.count, 0)).toBe(33)
  })

  it('drops and gathering are ordered G, then HR, then LR; quests by chance only', () => {
    const order = { G: 0, HR: 1, LR: 2 }
    const sorted = (xs: number[]) => xs.every((x, i) => i === 0 || xs[i - 1] <= x)
    for (const m of real.materials) {
      const v = sourceView(m, real)
      expect(sorted(v.drops.map((r) => order[r.rank])), `drops of ${m.name}`).toBe(true)
      expect(sorted(v.gathering.map((r) => order[r.rank])), `gathering of ${m.name}`).toBe(true)
      const q = v.quests.map((r) => r.percentage)
      expect(q, `quests of ${m.name}`).toEqual([...q].sort((a, b) => b - a))
    }
    // Machalite Ore: HR rows come before LR rows (it has no G gathering)
    const g = sourceView(mat(205), real).gathering
    expect([g[0].rank, g.at(-1)?.rank]).toEqual(['HR', 'LR'])
    // a material with all three ranks in its drops starts with G
    const withG = real.materials.find((m) => new Set(m.drops.map((d) => d.rank)).size === 3)
    expect(withG).toBeDefined()
    expect(sourceView(withG as Material, real).drops[0].rank).toBe('G')
  })

  it('(a) no source of any kind: Bumblepumpkin (201)', () => {
    expect(mat(201).name).toBe('Bumblepumpkin')
    expect(sourceView(mat(201), real)).toMatchObject({ drops: [], gathering: [], quests: [], coverage: 'none', otherKinds: [] })
  })

  it('(b) only sources v1 does not show: kinds named from the material own data', () => {
    expect(mat(16).name).toBe('Demondrug')
    const v = sourceView(mat(16), real)
    expect(v.coverage).toBe('otherOnly')
    expect([...v.drops, ...v.gathering, ...v.quests]).toEqual([])
    expect(v.otherKinds).toEqual(['Combining', 'Veggie Elder'])
    const arzuros = real.materials.find((m) => m.name === 'Arzuros Shell')
    expect(arzuros).toBeDefined()
    const a = sourceView(arzuros as Material, real)
    expect(a.coverage).toBe('otherOnly')
    expect(a.otherKinds).toEqual(['Wyporium trade'])
  })

  it('(c) shown sources: coverage "shown", other kinds are listed but not displayed', () => {
    const v = sourceView(mat(205), real) // has a combining source
    expect(v.coverage).toBe('shown')
    expect(v.otherKinds).toEqual(['Combining'])
  })

  it('counts over the data: 54 with no source, 145 with only hidden kinds, 897 with shown sources', () => {
    const c = { none: 0, otherOnly: 0, shown: 0 }
    for (const m of real.materials) c[sourceView(m, real).coverage]++
    expect(c).toEqual({ none: 54, otherOnly: 145, shown: 897 })
  })

  it('a null-percentage drop shows "?" and sorts last; a 0-percentage drop shows "0%"', () => {
    const nul = sourceView(mat(1078), real).drops
    expect(nul.every((d) => d.percentage === null)).toBe(true)
    expect(formatChance(nul[0].percentage)).toBe('?')
    const fatalis = sourceView(mat(1022), real).drops
    expect(fatalis.map((d) => formatChance(d.percentage))).toContain('0%')
  })

  it('names resolve with no issues for every material in the data', () => {
    const issues = real.materials.flatMap((m) => sourceView(m, real).issues)
    expect(issues).toEqual([])
  })
})

describe('sourceView fixtures', () => {
  const material = (over: Partial<Material>): Material => ({
    id: 1,
    name: 'Ore',
    rarity: 1,
    drops: [],
    gathering: [],
    sources: { quests: [], arena: [], combining: [], veggieElder: [], wyporium: [] },
    ...over,
  })
  const data = (over: Partial<GameData> = {}) => mkData(over)

  it('unknown ids get fallback names and are listed once as issues, without throwing', () => {
    const m = material({
      drops: [
        { monsterId: 9, rank: 'LR', condition: 'c', percentage: 5, stackSize: 1 },
        { monsterId: 9, rank: 'HR', condition: 'c', percentage: 5, stackSize: 1 },
      ],
      gathering: [{ locationId: 7, area: 'a', site: 's', rank: 'LR', quantity: 1, percentage: 1 }],
      sources: { quests: [{ questId: 3, slot: 'A', percentage: 5, stackSize: 1 }], arena: [], combining: [], veggieElder: [], wyporium: [] },
    })
    const v = sourceView(m, data())
    expect(v.drops.map((d) => d.monsterName)).toEqual(['Monster #9', 'Monster #9'])
    expect(v.gathering[0].locationName).toBe('Location #7')
    expect(v.quests[0].questName).toBe('Quest #3')
    expect(v.issues).toEqual([{ kind: 'unknownMonster', id: 9 }, { kind: 'unknownLocation', id: 7 }, { kind: 'unknownQuest', id: 3 }])
  })

  it('quests are looked up by (kind, id): an arena quest with the same id is not used', () => {
    const d = data({
      quests: [
        { id: 1, kind: 'arena', name: 'Arena', hub: null, type: null, stars: null },
        { id: 1, kind: 'quest', name: 'Real', hub: 'Guild', type: 'Normal', stars: 4 },
      ],
    })
    const m = material({ sources: { quests: [{ questId: 1, slot: 'B', percentage: 20, stackSize: 1 }], arena: [], combining: [], veggieElder: [], wyporium: [] } })
    expect(sourceView(m, d).quests[0]).toMatchObject({ questName: 'Real', hub: 'Guild', stars: 4, slot: 'B' })
  })

  it('duplicates collapse only when every field is equal; ordering is chance desc, null last, then name', () => {
    const d = data({ monsters: [{ id: 1, name: 'Zed', class: 'c', hitzones: [] }, { id: 2, name: 'Abe', class: 'c', hitzones: [] }] })
    const drop = (monsterId: number, percentage: number | null, stackSize = 1) => ({ monsterId, rank: 'G' as const, condition: 'x', percentage, stackSize })
    const m = material({ drops: [drop(1, 10), drop(2, null), drop(1, 10), drop(1, 10, 2), drop(2, 10), drop(1, 0)] })
    const v = sourceView(m, d)
    expect(v.drops.map((r) => [r.monsterName, r.percentage, r.stackSize, r.count])).toEqual([
      ['Abe', 10, 1, 1],
      ['Zed', 10, 1, 2],
      ['Zed', 10, 2, 1],
      ['Zed', 0, 1, 1],
      ['Abe', null, 1, 1],
    ])
  })

  it('rank order G, HR, LR beats chance; then chance desc, null last, then name; collapsed rows sort the same way', () => {
    const d = data({ monsters: [{ id: 1, name: 'B', class: 'c', hitzones: [] }, { id: 2, name: 'A', class: 'c', hitzones: [] }] })
    const drop = (monsterId: number, rank: 'LR' | 'HR' | 'G', percentage: number | null) => ({ monsterId, rank, condition: 'x', percentage, stackSize: 1 })
    const m = material({ drops: [drop(1, 'LR', 90), drop(1, 'G', null), drop(2, 'G', 5), drop(1, 'HR', 50), drop(1, 'G', 5), drop(1, 'G', 5), drop(2, 'HR', 50)] })
    const v = sourceView(m, d)
    expect(v.drops.map((r) => [r.rank, r.percentage, r.monsterName, r.count])).toEqual([
      ['G', 5, 'A', 1],
      ['G', 5, 'B', 2],
      ['G', null, 'B', 1],
      ['HR', 50, 'A', 1],
      ['HR', 50, 'B', 1],
      ['LR', 90, 'B', 1],
    ])
  })

  it('byChance without rank (quests) ignores rank and orders by chance then name', () => {
    const rows = [{ percentage: null, n: 'a' }, { percentage: 10, n: 'b' }, { percentage: 10, n: 'a' }, { percentage: 20, n: 'z' }]
    expect(rows.sort(byChance((r) => r.n)).map((r) => `${r.percentage}${r.n}`)).toEqual(['20z', '10a', '10b', 'nulla'])
  })

  it('(b) in a fixture: kinds in plain words, in a fixed order', () => {
    const m = material({
      sources: {
        quests: [],
        arena: [{ arenaQuestId: 1, percentage: 1, stackSize: 1 }],
        combining: [{ item1Id: 1, item2Id: 2, amountMin: 1, amountMax: 1, percentage: 1 }],
        veggieElder: [{ offerItemId: 1, quantity: 1 }],
        wyporium: [{ itemInId: 1, itemOutId: 2, unlockQuestId: null }],
      },
    })
    expect(sourceView(m, data())).toMatchObject({ coverage: 'otherOnly', otherKinds: ['Wyporium trade', 'Arena', 'Combining', 'Veggie Elder'] })
  })
})
