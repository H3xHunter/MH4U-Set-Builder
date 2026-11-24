import { describe, expect, it } from 'vitest'
import type { SavedCharm } from '@/data/types'
import { CHARMS_KEY, loadCharms, saveCharms } from '@/lib/charms'
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

  it('weapon: slots count in the totals, armor stays when the weapon changes, removing the weapon drops its decorations', () => {
    let s = reduce(emptyBuild(), { type: 'setArmor', slot: 'head', armorId: head.id })
    s = reduce(s, { type: 'setWeapon', weapon: { kind: 'slots', slots: 2 } })
    expect(slotTotals(s, deriveBuild(s, ctx), ctx)).toEqual({ used: 0, capacity: 4 })
    const deco = data.decorations.find((d) => d.size === 2)!
    s = reduce(s, { type: 'addDeco', target: { kind: 'weapon' }, decoId: deco.id })
    expect(slotTotals(s, deriveBuild(s, ctx), ctx)).toEqual({ used: 2, capacity: 4 })
    const gunner = data.weapons.find((w) => w.class === 'Bow')!
    s = reduce(s, { type: 'setWeapon', weapon: { kind: 'data', weaponId: gunner.id } })
    expect(s.armor.head?.armorId).toBe(head.id)
    s = reduce(s, { type: 'setWeapon', weapon: { kind: 'none' } })
    expect(s.weaponDecos).toEqual([])
    expect(s.armor.head?.armorId).toBe(head.id)
  })

  describe('charm list changes (the hook normalizes after each one)', () => {
    const charm: SavedCharm = { id: 'c1', name: '', slots: 2, skills: { '118': 3 } }
    const withCharm = (charms: BuildContext['charms']): BuildContext => ({ data, charms })
    const deco1 = data.decorations.find((d) => d.size === 1)!
    const equipped = () => {
      const c = withCharm([charm])
      let s = makeReducer(c)(emptyBuild(), { type: 'setCharm', charmId: 'c1' })
      s = makeReducer(c)(s, { type: 'addDeco', target: { kind: 'charm' }, decoId: deco1.id })
      s = makeReducer(c)(s, { type: 'addDeco', target: { kind: 'charm' }, decoId: deco1.id })
      return s
    }

    it('deleting the equipped charm unequips it and drops its decorations', () => {
      const s = equipped()
      expect(s.charm).toEqual({ charmId: 'c1', decos: [deco1.id, deco1.id] })
      const after = makeReducer(withCharm([]))(s, { type: 'normalize' })
      expect(after.charm).toEqual({ charmId: null, decos: [] })
      expect(deriveBuild(after, withCharm([])).skills).toEqual([])
    })

    it('deleting another charm changes nothing', () => {
      const s = equipped()
      expect(makeReducer(withCharm([charm, { ...charm, id: 'c2' }]))(s, { type: 'normalize' })).toBe(s)
    })

    it('editing the equipped charm updates the build; fewer slots drop the decorations that no longer fit', () => {
      const s = equipped()
      const edited = withCharm([{ ...charm, skills: { '118': 5 }, slots: 1 }])
      const after = makeReducer(edited)(s, { type: 'normalize' })
      expect(after.charm).toEqual({ charmId: 'c1', decos: [deco1.id] })
      expect(deriveBuild(after, edited).skills.find((r) => r.treeId === 118)?.charm).toBe(5)
    })
  })

  describe('another tab changes the saved charms (what the storage listener does)', () => {
    const mem = () => {
      const m = new Map<string, string>()
      return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
    }
    const a: SavedCharm = { id: 'a', name: '', slots: 2, skills: { '118': 3 } }
    const b: SavedCharm = { id: 'b', name: 'B', slots: 1, skills: {} }

    it('reloads through the validating loader; an equipped charm that vanished is unequipped, others stay', () => {
      const st = mem()
      saveCharms(data, [a, b], st)
      const first = loadCharms(data, st).charms
      let s = makeReducer({ data, charms: first })(emptyBuild(), { type: 'setCharm', charmId: 'a' })
      saveCharms(data, [b], st) // the other tab deleted 'a'
      const next = { data, charms: loadCharms(data, st).charms }
      expect(makeReducer(next)(s, { type: 'normalize' }).charm.charmId).toBeNull()
      s = makeReducer({ data, charms: first })(emptyBuild(), { type: 'setCharm', charmId: 'b' })
      expect(makeReducer(next)(s, { type: 'normalize' })).toBe(s)
    })

    it('a corrupted value from the other tab loads as an empty list with an issue (never trusted)', () => {
      const st = mem()
      st.m.set(CHARMS_KEY, '{oops')
      const r = loadCharms(data, st)
      expect(r.charms).toEqual([])
      expect(r.issues.length).toBeGreaterThan(0)
    })
  })
})
