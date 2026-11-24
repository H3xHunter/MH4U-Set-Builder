import { describe, expect, it } from 'vitest'
import { loadRealData } from '@/data/real-data-fixture'
import { mkArmor } from '@/state/fixtures'
import { filterArmor, matchesClass, type ArmorFilter } from './armorFilter'

const base: ArmorFilter = { slot: 'head', query: '', cls: 'all', skillId: null, minSlots: 0 }
const trees = [
  { id: 1, name: 'Attack Up', tiers: [] },
  { id: 2, name: 'Guard', tiers: [] },
]
const ids = (r: { id: number }[]) => r.map((a) => a.id)

describe('filterArmor (small fixture)', () => {
  const armor = [
    mkArmor(1, 'head', 2, { name: 'Alpha', hunterType: 'blade', rarity: 3, skills: { '1': 2 } }),
    mkArmor(2, 'head', 0, { name: 'Beta', hunterType: 'gunner', rarity: 5, skills: { '2': -1 } }),
    mkArmor(3, 'head', 3, { name: 'Gamma', hunterType: 'both', rarity: 5, skills: { '2': 3 } }),
    mkArmor(4, 'head', 1, { name: 'Delta', hunterType: null, rarity: 1 }),
    mkArmor(5, 'chest', 1, { name: 'Chesty', rarity: 9 }),
  ]

  it('lists only the slot, sorted by rarity desc then name', () => {
    expect(ids(filterArmor(armor, trees, base))).toEqual([2, 3, 1, 4])
  })

  it('applies class semantics, with null matching every filter', () => {
    expect(ids(filterArmor(armor, trees, { ...base, cls: 'blade' }))).toEqual([3, 1, 4])
    expect(ids(filterArmor(armor, trees, { ...base, cls: 'gunner' }))).toEqual([2, 3, 4])
    expect(ids(filterArmor(armor, trees, { ...base, cls: 'all' }))).toHaveLength(4)
    expect(matchesClass(null, 'blade') && matchesClass(null, 'gunner')).toBe(true)
  })

  it('searches by name and by skill tree name, case-insensitively, including negative skills', () => {
    expect(ids(filterArmor(armor, trees, { ...base, query: 'ALP' }))).toEqual([1])
    expect(ids(filterArmor(armor, trees, { ...base, query: 'attack' }))).toEqual([1])
    expect(ids(filterArmor(armor, trees, { ...base, query: 'guard' }))).toEqual([2, 3])
  })

  it('treats the query as plain text, never a regex', () => {
    expect(filterArmor(armor, trees, { ...base, query: '.*' })).toEqual([])
    expect(filterArmor(armor, trees, { ...base, query: '(' })).toEqual([])
  })

  it('has-skill needs positive points', () => {
    expect(ids(filterArmor(armor, trees, { ...base, skillId: 2 }))).toEqual([3])
  })

  it('min slots', () => {
    expect(ids(filterArmor(armor, trees, { ...base, minSlots: 2 }))).toEqual([3, 1])
    expect(ids(filterArmor(armor, trees, { ...base, minSlots: 3 }))).toEqual([3])
  })
})

describe('filterArmor (real data)', () => {
  const data = loadRealData()
  const run = (f: Partial<ArmorFilter>) => filterArmor(data.armor, data.skills, { ...base, ...f })

  it('keeps the one null-class piece (Hawkeye Earring) in every class filter', () => {
    expect(data.armor.filter((a) => a.hunterType === null).map((a) => a.name)).toEqual(['Hawkeye Earring'])
    for (const cls of ['blade', 'gunner', 'all'] as const) {
      expect(run({ cls }).some((a) => a.name === 'Hawkeye Earring')).toBe(true)
    }
  })

  it('only returns the card slot, and the slot counts match the data', () => {
    expect(run({}).length).toBe(639)
    expect(run({ slot: 'chest' }).every((a) => a.slot === 'chest')).toBe(true)
  })

  it('finds Leather Headgear by name and by one of its skills, and sorts rarity descending', () => {
    const leather = data.armor.find((a) => a.name === 'Leather Headgear')!
    expect(run({ query: 'leather headgear' }).map((a) => a.id)).toContain(leather.id)
    const skillName = data.skills.find((t) => String(t.id) === Object.keys(leather.skills)[0])!.name
    expect(run({ query: skillName }).map((a) => a.id)).toContain(leather.id)
    const r = run({}).map((a) => a.rarity)
    expect(r).toEqual([...r].sort((a, b) => b - a))
  })
})
