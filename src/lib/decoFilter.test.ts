import { describe, expect, it } from 'vitest'
import { loadRealData } from '@/data/real-data-fixture'
import { applyAction, canAddDeco, emptyBuild, type BuildContext, type Target } from '@/state/build'
import { mkArmor, mkDeco } from '@/state/fixtures'
import { filterDecos, type DecoFilter } from './decoFilter'

const base: DecoFilter = { query: '', size: 0, onlyFits: false }

describe('filterDecos', () => {
  const data = loadRealData()
  const target: Target = { kind: 'armor', slot: 'head' }

  // A head piece with `slots` capacity, optionally with a size-1 deco already placed.
  const ctxWith = (slots: number): BuildContext => ({
    data: { ...data, armor: [...data.armor, mkArmor(900001, 'head', slots)] },
    charms: [],
  })
  const equipped = (ctx: BuildContext, placed: number[] = []) => {
    let s = applyAction(emptyBuild(), { type: 'setArmor', slot: 'head', armorId: 900001 }, ctx)
    for (const decoId of placed) s = applyAction(s, { type: 'addDeco', target, decoId }, ctx)
    return s
  }
  const oneSize1 = data.decorations.find((d) => d.size === 1)!.id

  it('filters by size', () => {
    for (const size of [1, 2, 3] as const) {
      const r = filterDecos(data.decorations, data.skills, { ...base, size }, () => true)
      expect(r.length).toBe(data.decorations.filter((d) => d.size === size).length)
      expect(r.every((d) => d.size === size)).toBe(true)
    }
  })

  it('"only show what fits" on a piece with 1 free slot keeps only size 1', () => {
    const ctx = ctxWith(2)
    const s = equipped(ctx, [oneSize1])
    const fits = (d: { id: number }) => canAddDeco(s, target, d.id, ctx)
    const r = filterDecos(data.decorations, data.skills, { ...base, onlyFits: true }, fits)
    expect(r.length).toBeGreaterThan(0)
    expect(r.every((d) => d.size === 1)).toBe(true)
  })

  it('searches by name and by skill tree name', () => {
    const d = data.decorations.find((x) => Object.keys(x.skills).length > 0)!
    const treeName = data.skills.find((t) => String(t.id) === Object.keys(d.skills)[0])!.name
    const r = filterDecos(data.decorations, data.skills, { ...base, query: treeName.toUpperCase() }, () => true)
    expect(r.map((x) => x.id)).toContain(d.id)
    expect(filterDecos(data.decorations, data.skills, { ...base, query: d.name.slice(0, 4) }, () => true).map((x) => x.id)).toContain(d.id)
  })

  it('is consistent with canAddDeco for every decoration on 1-free and 2-free pieces', () => {
    for (const free of [1, 2]) {
      const ctx = ctxWith(free)
      const s = equipped(ctx)
      const fits = (d: { id: number }) => canAddDeco(s, target, d.id, ctx)
      const r = filterDecos(data.decorations, data.skills, { ...base, onlyFits: true }, fits)
      expect(r.map((d) => d.id).sort()).toEqual(data.decorations.filter((d) => d.size <= free).map((d) => d.id).sort())
      for (const d of data.decorations) expect(fits(d)).toBe(d.size <= free)
    }
  })

  it('sorts by name', () => {
    const r = filterDecos([mkDeco(1, 1), mkDeco(3, 1), mkDeco(2, 1)], [], base, () => true)
    expect(r.map((d) => d.name)).toEqual(['deco1', 'deco2', 'deco3'])
  })
})
