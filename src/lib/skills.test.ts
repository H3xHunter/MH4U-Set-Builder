import { describe, expect, it } from 'vitest'
import type { Armor, ArmorSlot, Decoration, SkillTree } from '@/data/types'
import { activeTier, computeSkills, type SkillInput } from './skills'

const trees: SkillTree[] = [
  {
    id: 1,
    name: 'Attack',
    tiers: [
      { points: -20, name: 'Neg20', description: null },
      { points: -15, name: 'Neg15', description: null },
      { points: -10, name: 'Neg10', description: null },
      { points: 10, name: 'Pos10', description: null },
      { points: 15, name: 'Pos15', description: null },
      { points: 20, name: 'Pos20', description: null },
    ],
  },
  { id: 2, name: 'Other', tiers: [{ points: 10, name: 'O10', description: null }] },
  { id: 3, name: 'Third', tiers: [{ points: 5, name: 'T5', description: null }] },
]

const armor = (slot: ArmorSlot, skills: Record<string, number>, torsoUp = false): Armor => ({
  id: 1,
  name: slot,
  slot,
  hunterType: 'both',
  gender: 'both',
  slots: 3,
  defense: 1,
  maxDefense: null,
  res: { fire: 0, water: 0, thunder: 0, ice: 0, dragon: 0 },
  skills,
  torsoUp,
  rarity: 1,
  materials: [],
})
const deco = (skills: Record<string, number>, size = 1): Decoration => ({ id: 1, name: 'd', size, skills, color: 'red' })
const piece = (slot: ArmorSlot, skills: Record<string, number>, decorations: Decoration[] = [], torsoUp = false) => ({
  armor: armor(slot, skills, torsoUp),
  decorations,
})
const input = (over: Partial<SkillInput>): SkillInput => ({ pieces: {}, charm: null, weaponDecorations: [], ...over })
const row = (i: SkillInput, id = 1) => computeSkills(i, trees).find((r) => r.treeId === id)

describe('activeTier', () => {
  const t = trees[0].tiers
  it('positive boundaries', () => {
    expect(activeTier(t, 0)).toBeNull()
    expect(activeTier(t, 9)).toBeNull()
    expect(activeTier(t, 10)?.name).toBe('Pos10')
    expect(activeTier(t, 14)?.name).toBe('Pos10')
    expect(activeTier(t, 15)?.name).toBe('Pos15')
    expect(activeTier(t, 19)?.name).toBe('Pos15')
    expect(activeTier(t, 20)?.name).toBe('Pos20')
    expect(activeTier(t, 99)?.name).toBe('Pos20')
  })
  it('negative boundaries', () => {
    expect(activeTier(t, -9)).toBeNull()
    expect(activeTier(t, -10)).toEqual({ points: -10, name: 'Neg10' })
    expect(activeTier(t, -12)?.name).toBe('Neg10')
    expect(activeTier(t, -14)?.name).toBe('Neg10')
    expect(activeTier(t, -15)?.name).toBe('Neg15')
    expect(activeTier(t, -17)?.name).toBe('Neg15')
    expect(activeTier(t, -19)?.name).toBe('Neg15')
    expect(activeTier(t, -20)?.name).toBe('Neg20')
  })
  it('total beyond the lowest negative threshold', () => expect(activeTier(t, -25)?.name).toBe('Neg20'))
  it('no tiers gives null', () => expect(activeTier([], 5)).toBeNull())
})

describe('computeSkills', () => {
  it('sums armor, charm and decorations; base tier differs from total tier', () => {
    const r = row(
      input({
        pieces: { head: piece('head', { '1': 6 }, [deco({ '1': 4 })]) },
        charm: { skills: { '1': 4 }, decorations: [deco({ '1': 1 })] },
        weaponDecorations: [deco({ '1': 5 })],
      }),
    )!
    expect(r).toMatchObject({ armor: 6, charm: 4, deco: 10, base: 10, total: 20 })
    expect(r.baseTier?.name).toBe('Pos10')
    expect(r.totalTier?.name).toBe('Pos20')
  })
  it('negative decoration points reduce total only', () => {
    const r = row(input({ pieces: { head: piece('head', { '1': 10 }, [deco({ '1': -3 })]) } }))!
    expect(r).toMatchObject({ base: 10, deco: -3, total: 7 })
    expect(r.baseTier?.name).toBe('Pos10')
    expect(r.totalTier).toBeNull()
  })
  it('negative total picks negative tier', () => {
    const r = row(input({ pieces: { head: piece('head', { '1': -17 }) } }))!
    expect(r.totalTier?.name).toBe('Neg15')
  })
  it('empty (slots-only) charm contributes nothing', () => {
    expect(computeSkills(input({ charm: { skills: {}, decorations: [] } }), trees)).toEqual([])
  })
  it('charm with skills', () => {
    const r = row(input({ charm: { skills: { '1': 10, '2': 3 }, decorations: [] } }))!
    expect(r).toMatchObject({ charm: 10, base: 10, total: 10 })
    expect(row(input({ charm: { skills: { '1': 10, '2': 3 }, decorations: [] } }), 2)?.charm).toBe(3)
  })

  describe('Torso Up', () => {
    const chest = piece('chest', { '1': 4, '2': -2 }, [deco({ '1': 3 })])
    const tu = (slot: ArmorSlot) => piece(slot, { '3': 1 }, [deco({ '1': 100 })], true)

    it('n=0 copies nothing', () => {
      const r = row(input({ pieces: { chest } }))!
      expect(r).toMatchObject({ torsoUpBase: 0, torsoUpDeco: 0, base: 4, total: 7 })
    })
    it('n=1 copies chest armor points and chest decorations', () => {
      const r = row(input({ pieces: { chest, head: tu('head') } }))!
      expect(r).toMatchObject({ armor: 4, torsoUpBase: 4, deco: 103, torsoUpDeco: 3, base: 8, total: 114 })
    })
    it('n=2 triples', () => {
      const r = row(input({ pieces: { chest, head: tu('head'), legs: tu('legs') } }))!
      expect(r).toMatchObject({ torsoUpBase: 8, torsoUpDeco: 6, base: 12 })
    })
    it('negative points are multiplied too', () => {
      expect(row(input({ pieces: { chest, head: tu('head'), legs: tu('legs') } }), 2)).toMatchObject({
        armor: -2,
        torsoUpBase: -4,
        base: -6,
      })
    })
    it("the Torso Up piece's own skills count normally", () => {
      expect(row(input({ pieces: { chest, head: tu('head') } }), 3)).toMatchObject({ armor: 1, base: 1 })
    })
    it('other-piece decorations and the charm are not copied', () => {
      const r = row(
        input({
          pieces: { chest: piece('chest', { '1': 1 }), head: tu('head') },
          charm: { skills: { '1': 5 }, decorations: [deco({ '1': 7 })] },
        }),
      )!
      expect(r).toMatchObject({ torsoUpBase: 1, torsoUpDeco: 0 })
    })
    it('no chest worn gives 0', () => {
      const r = row(input({ pieces: { head: tu('head') } }))!
      expect(r).toMatchObject({ torsoUpBase: 0, torsoUpDeco: 0 })
    })
    it('a chest piece with the flag does not count itself', () => {
      const flagged = piece('chest', { '1': 4 }, [deco({ '1': 3 })], true)
      expect(row(input({ pieces: { chest: flagged } }))).toMatchObject({ torsoUpBase: 0, torsoUpDeco: 0, total: 7 })
      expect(row(input({ pieces: { chest: flagged, head: tu('head') } }))).toMatchObject({ torsoUpBase: 4 })
    })
  })

  it('omits trees with no contribution', () => {
    const rows = computeSkills(input({ pieces: { head: piece('head', { '2': 0 }) } }), trees)
    expect(rows).toEqual([])
  })
  it('orders rows by tree id regardless of input order', () => {
    const a = computeSkills(input({ pieces: { head: piece('head', { '3': 1, '1': 1, '2': 1 }) } }), trees)
    const b = computeSkills(input({ pieces: { head: piece('head', { '2': 1, '3': 1, '1': 1 }) } }), trees)
    expect(a.map((r) => r.treeId)).toEqual([1, 2, 3])
    expect(b).toEqual(a)
  })
})
