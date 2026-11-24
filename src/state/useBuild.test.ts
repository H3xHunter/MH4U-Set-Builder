import { describe, expect, it } from 'vitest'
import { loadRealData } from '@/data/real-data-fixture'
import { emptyBuild, type BuildContext } from './build'
import { deriveBuild } from './derive'
import { makeReducer, slotTotals } from './useBuild'

describe('useBuild reducer and helpers', () => {
  const data = loadRealData()
  const ctx: BuildContext = { data, charms: [] }
  const reduce = makeReducer(ctx)
  const head = data.armor.find((a) => a.slot === 'head' && a.slots === 2)!
  const chest = data.armor.find((a) => a.slot === 'chest')!

  it('rejects armor equipped in the wrong slot and returns the same state object', () => {
    const s = emptyBuild()
    expect(reduce(s, { type: 'setArmor', slot: 'head', armorId: chest.id })).toBe(s)
  })

  it('equips, removes, and reports slot totals as used / capacity of what is equipped', () => {
    let s = reduce(emptyBuild(), { type: 'setArmor', slot: 'head', armorId: head.id })
    expect(s.armor.head?.armorId).toBe(head.id)
    expect(slotTotals(s, deriveBuild(s, ctx), ctx)).toEqual({ used: 0, capacity: 2 })
    const deco = data.decorations.find((d) => d.size === 1)!
    s = reduce(s, { type: 'addDeco', target: { kind: 'armor', slot: 'head' }, decoId: deco.id })
    expect(slotTotals(s, deriveBuild(s, ctx), ctx)).toEqual({ used: 1, capacity: 2 })
    s = reduce(s, { type: 'setArmor', slot: 'head', armorId: null })
    expect(slotTotals(s, deriveBuild(s, ctx), ctx)).toEqual({ used: 0, capacity: 0 })
  })

  it('normalize drops nothing from a valid build and keeps the same object', () => {
    const s = reduce(emptyBuild(), { type: 'setArmor', slot: 'head', armorId: head.id })
    expect(reduce(s, { type: 'normalize' })).toBe(s)
  })
})
