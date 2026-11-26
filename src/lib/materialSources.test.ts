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
    expect(sourceView(mat(201), real)).toMatchObject({ drops: [], gathering: [], quests: [], wyporium: [], arena: [], veggieElder: false, coverage: 'none', otherKinds: [] })
  })

  it('(b) combining only: Gunpowder (32) says so and nothing else is shown', () => {
    expect(mat(32).name).toBe('Gunpowder')
    const v = sourceView(mat(32), real)
    expect(v.coverage).toBe('otherOnly')
    expect(v.otherKinds).toEqual(['Combining'])
    expect([...v.drops, ...v.gathering, ...v.quests, ...v.wyporium, ...v.arena]).toEqual([])
    expect(v.veggieElder).toBe(false)
  })

  it('(c) shown sources: Machalite Ore keeps its drops and quests; Combining is named but not displayed', () => {
    const v = sourceView(mat(205), real)
    expect(v.coverage).toBe('shown')
    expect(v.otherKinds).toEqual(['Combining'])
  })

  it('Wyporium: Arzuros Shell (1094) is received by handing in G.Jaggi Claw, unlocked by "Swing into Action"', () => {
    const v = sourceView(mat(1094), real)
    expect(v.wyporium).toEqual([{ handInItemId: 390, handInName: 'G.Jaggi Claw', unlockQuest: { name: 'Swing into Action', hub: 'Caravan', stars: 3 } }])
    expect(v.coverage).toBe('shown')
  })

  it('Wyporium: Nargacuga Cutwing+ (1184) is in two trades, sorted by hand-in name', () => {
    const v = sourceView(mat(1184), real)
    expect(v.wyporium.map((w) => [w.handInItemId, w.handInName, w.unlockQuest?.name, w.unlockQuest?.hub, w.unlockQuest?.stars])).toEqual([
      [744, 'Zinogre Claw', 'Uncorner the Market', 'Caravan', 5],
      [746, 'Zinogre Hardclaw', 'Advanced: Bolt of Pink', 'Guild', 9],
    ])
  })

  it('data invariant: the 128 Wyporium trades have no duplicate trade and no reversed pair (sourceView does not collapse them)', () => {
    // Every trade is stored under both of its materials; the received side lists it once per trade.
    const trades = real.materials.flatMap((m) => m.sources.wyporium.filter((w) => w.itemInId === m.id))
    expect(trades).toHaveLength(128)
    const key = (a: number, b: number, q: number | null) => `${a}>${b}>${q}`
    const keys = trades.map((w) => key(w.itemInId, w.itemOutId, w.unlockQuestId))
    expect(new Set(keys).size).toBe(keys.length) // no two share (itemInId, itemOutId, unlockQuestId)
    const pairs = new Set(trades.map((w) => `${w.itemInId}>${w.itemOutId}`))
    expect(pairs.size).toBe(trades.length) // not even the same pair with another unlock quest
    expect(trades.filter((w) => pairs.has(`${w.itemOutId}>${w.itemInId}`))).toEqual([]) // A in/B out and B in/A out
  })

  it('Wyporium: a material that is only the hand-in side gets no Wyporium rows (G.Jaggi Claw 390)', () => {
    expect(mat(390).sources.wyporium).toHaveLength(1) // it is in a trade...
    const v = sourceView(mat(390), real)
    expect(v.wyporium).toEqual([]) // ...but only as the item handed in
    expect(v.drops.length + v.quests.length).toBeGreaterThan(0)
  })

  it('every trade: exactly one received side and one hand-in side; received materials get one row per trade', () => {
    let rows = 0
    for (const m of real.materials) rows += sourceView(m, real).wyporium.length
    expect(rows).toBe(128) // all 128 trades, seen from the received side
  })

  it('Arena: Pinnacle Coin (1323) lists its arena quests in a separate id space', () => {
    const v = sourceView(mat(1323), real)
    expect(v.arena).toHaveLength(3)
    expect(v.arena.map((r) => r.questName)).toEqual(expect.arrayContaining(['Grudge Match: Yian Kut-Ku', 'Grudge Match: Kecha Wacha']))
    expect(v.arena.every((r) => r.percentage > 0 && r.stackSize >= 1)).toBe(true)
    // arena ids 1..16 overlap quest ids: the names above come from kind 'arena', not 'quest'
    const p = v.arena.map((r) => r.percentage)
    expect(p).toEqual([...p].sort((a, b) => b - a))
  })

  it('Veggie Elder: Demondrug (16) is a plain flag; its only other kind is Combining', () => {
    const v = sourceView(mat(16), real)
    expect(v.veggieElder).toBe(true)
    expect(v.coverage).toBe('shown')
    expect(v.otherKinds).toEqual(['Combining'])
    expect(sourceView(mat(201), real).veggieElder).toBe(false)
  })

  it('all 118 materials whose only extra source was the Wyporium now report coverage "shown"', () => {
    const only = real.materials.filter(
      (m) =>
        m.sources.wyporium.length > 0 &&
        m.drops.length + m.gathering.length + m.sources.quests.length + m.sources.arena.length + m.sources.combining.length + m.sources.veggieElder.length === 0,
    )
    expect(only).toHaveLength(118)
    expect(only.every((m) => sourceView(m, real).coverage === 'shown')).toBe(true)
  })

  it('counts over the data: 54 with no source, 1 combining only, 1041 shown', () => {
    const c = { none: 0, otherOnly: 0, shown: 0 }
    for (const m of real.materials) c[sourceView(m, real).coverage]++
    expect(c).toEqual({ none: 54, otherOnly: 1, shown: 1041 })
  })

  it('a null-percentage drop shows "?" and sorts last; a 0-percentage drop shows "0%"', () => {
    const nul = sourceView(mat(1078), real).drops
    expect(nul.every((d) => d.percentage === null)).toBe(true)
    expect(formatChance(nul[0].percentage)).toBe('?')
    const fatalis = sourceView(mat(1022), real).drops
    expect(fatalis.map((d) => formatChance(d.percentage))).toContain('0%')
  })

  it('every id in the data resolves: no fallback name appears anywhere', () => {
    const text = JSON.stringify(real.materials.map((m) => sourceView(m, real)))
    expect(text).not.toMatch(/(Monster|Location|Quest|Arena quest|Item) #\d/)
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

  it('unknown ids get fallback names without throwing', () => {
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

  it('fixture: arena, wyporium (received side only), veggie elder and combining; unknown ids fall back', () => {
    const d = data({
      quests: [
        { id: 7, kind: 'quest', name: 'Real Quest', hub: 'Guild', type: 'Normal', stars: 6 },
        { id: 7, kind: 'arena', name: 'Arena Seven', hub: null, type: null, stars: null },
      ],
      items: [{ id: 50, name: 'Hand In Item', type: 't', rarity: 1 }],
    })
    const m = material({
      id: 10,
      sources: {
        quests: [],
        arena: [{ arenaQuestId: 7, percentage: 20, stackSize: 2 }, { arenaQuestId: 99, percentage: 5, stackSize: 1 }],
        combining: [{ item1Id: 1, item2Id: 2, amountMin: 1, amountMax: 1, percentage: 1 }],
        veggieElder: [{ offerItemId: 1, quantity: 1 }],
        wyporium: [
          { itemInId: 10, itemOutId: 50, unlockQuestId: 7 }, // received: a row
          { itemInId: 11, itemOutId: 10, unlockQuestId: 7 }, // handed in: no row
          { itemInId: 10, itemOutId: 51, unlockQuestId: null }, // unknown hand-in item, no unlock quest
          { itemInId: 10, itemOutId: 50, unlockQuestId: 8 }, // unknown unlock quest
        ],
      },
    })
    const v = sourceView(m, d)
    expect(v.arena.map((r) => [r.questName, r.percentage, r.stackSize])).toEqual([['Arena Seven', 20, 2], ['Arena quest #99', 5, 1]])
    expect(v.wyporium).toEqual([
      { handInItemId: 50, handInName: 'Hand In Item', unlockQuest: { name: 'Real Quest', hub: 'Guild', stars: 6 } },
      { handInItemId: 50, handInName: 'Hand In Item', unlockQuest: { name: 'Quest #8', hub: null, stars: null } },
      { handInItemId: 51, handInName: 'Item #51', unlockQuest: null },
    ])
    expect(v.veggieElder).toBe(true)
    expect(v.coverage).toBe('shown')
    expect(v.otherKinds).toEqual(['Combining'])
  })

  it('fixture: a material that is only the hand-in side and has nothing else is "none"', () => {
    const m = material({
      id: 10,
      sources: { quests: [], arena: [], combining: [], veggieElder: [], wyporium: [{ itemInId: 11, itemOutId: 10, unlockQuestId: null }] },
    })
    expect(sourceView(m, data())).toMatchObject({ wyporium: [], coverage: 'none' })
  })
})
