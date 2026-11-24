import { describe, expect, it } from 'vitest'
import {
  applyAction,
  canAddDeco,
  capacityOf,
  emptyBuild,
  normalizeBuild,
  type Action,
  type BuildContext,
  type BuildState,
  type SavedCharm,
} from './build'
import { mkArmor, mkData, mkDeco, mkWeapon } from './fixtures'

const charm = (slots: SavedCharm['slots'], id = 'c1'): SavedCharm => ({ id, name: id, slots, skills: {} })
const ctx = (charms: SavedCharm[] = [charm(2)]): BuildContext => ({
  data: mkData({
    armor: [mkArmor(1, 'head', 3), mkArmor(2, 'head', 1), mkArmor(3, 'chest', 2)],
    decorations: [mkDeco(10, 1), mkDeco(11, 2), mkDeco(12, 3)],
    weapons: [mkWeapon(100, 2), mkWeapon(101, 0)],
  }),
  charms,
})
const run = (s: BuildState, a: Action, c = ctx()) => applyAction(s, a, c)
const seq = (actions: Action[], c = ctx()) => actions.reduce((s, a) => applyAction(s, a, c), emptyBuild())
const head = { kind: 'armor', slot: 'head' } as const

describe('setWeapon', () => {
  it('accepts none, custom slots and data weapons', () => {
    expect(run(emptyBuild(), { type: 'setWeapon', weapon: { kind: 'slots', slots: 3 } }).weapon).toEqual({ kind: 'slots', slots: 3 })
    expect(run(emptyBuild(), { type: 'setWeapon', weapon: { kind: 'data', weaponId: 100 } }).weapon).toEqual({ kind: 'data', weaponId: 100 })
    expect(run(emptyBuild(), { type: 'setWeapon', weapon: { kind: 'none' } }).weapon).toEqual({ kind: 'none' })
  })
  it('rejects unknown weapon ids and bad slot counts, same reference', () => {
    const s = emptyBuild()
    expect(run(s, { type: 'setWeapon', weapon: { kind: 'data', weaponId: 999 } })).toBe(s)
    expect(run(s, { type: 'setWeapon', weapon: { kind: 'slots', slots: 4 as 3 } })).toBe(s)
  })
  it('trims weapon decorations that no longer fit, from the end', () => {
    const s = seq([
      { type: 'setWeapon', weapon: { kind: 'slots', slots: 3 } },
      { type: 'addDeco', target: { kind: 'weapon' }, decoId: 10 },
      { type: 'addDeco', target: { kind: 'weapon' }, decoId: 11 },
    ])
    expect(s.weaponDecos).toEqual([10, 11])
    expect(run(s, { type: 'setWeapon', weapon: { kind: 'slots', slots: 2 } }).weaponDecos).toEqual([10])
    expect(run(s, { type: 'setWeapon', weapon: { kind: 'data', weaponId: 101 } }).weaponDecos).toEqual([])
  })
})

describe('setArmor', () => {
  it('sets and clears a piece', () => {
    const s = run(emptyBuild(), { type: 'setArmor', slot: 'head', armorId: 1 })
    expect(s.armor.head).toEqual({ armorId: 1, decos: [] })
    expect(run(s, { type: 'setArmor', slot: 'head', armorId: null }).armor.head).toBeNull()
  })
  it('rejects unknown ids and pieces for the wrong slot, same reference', () => {
    const s = emptyBuild()
    expect(run(s, { type: 'setArmor', slot: 'head', armorId: 999 })).toBe(s)
    expect(run(s, { type: 'setArmor', slot: 'legs', armorId: 1 })).toBe(s)
  })
  it('keeps decorations that still fit, in order, and drops the rest from the end', () => {
    const s = seq([
      { type: 'setArmor', slot: 'head', armorId: 1 },
      { type: 'addDeco', target: head, decoId: 10 },
      { type: 'addDeco', target: head, decoId: 11 },
    ])
    expect(s.armor.head?.decos).toEqual([10, 11])
    expect(run(s, { type: 'setArmor', slot: 'head', armorId: 2 }).armor.head?.decos).toEqual([10])
  })
  it('drops from the end even when a later, smaller one would fit', () => {
    const s = seq([
      { type: 'setArmor', slot: 'head', armorId: 1 },
      { type: 'addDeco', target: head, decoId: 10 },
      { type: 'addDeco', target: head, decoId: 11 },
    ])
    const c = ctx()
    c.data.armor.push(mkArmor(4, 'head', 2))
    expect(run({ ...s, armor: { ...s.armor, head: { armorId: 1, decos: [10, 11, 10] } } }, { type: 'setArmor', slot: 'head', armorId: 4 }, c).armor.head?.decos).toEqual([10])
  })
})

describe('addDeco / removeDeco', () => {
  it('adds while it fits and rejects with the same reference when it does not', () => {
    const s = seq([
      { type: 'setArmor', slot: 'head', armorId: 1 },
      { type: 'addDeco', target: head, decoId: 11 },
      { type: 'addDeco', target: head, decoId: 10 },
    ])
    expect(s.armor.head?.decos).toEqual([11, 10])
    expect(run(s, { type: 'addDeco', target: head, decoId: 10 })).toBe(s)
  })
  it('rejects unknown decorations and empty armor slots', () => {
    const s = run(emptyBuild(), { type: 'setArmor', slot: 'head', armorId: 1 })
    expect(run(s, { type: 'addDeco', target: head, decoId: 999 })).toBe(s)
    expect(run(s, { type: 'addDeco', target: { kind: 'armor', slot: 'legs' }, decoId: 10 })).toBe(s)
    expect(run(s, { type: 'addDeco', target: { kind: 'weapon' }, decoId: 10 })).toBe(s)
    expect(run(s, { type: 'addDeco', target: { kind: 'charm' }, decoId: 10 })).toBe(s)
  })
  it('adds to the charm and the weapon', () => {
    const s = seq([
      { type: 'setCharm', charmId: 'c1' },
      { type: 'addDeco', target: { kind: 'charm' }, decoId: 11 },
      { type: 'setWeapon', weapon: { kind: 'slots', slots: 1 } },
      { type: 'addDeco', target: { kind: 'weapon' }, decoId: 10 },
    ])
    expect(s.charm.decos).toEqual([11])
    expect(s.weaponDecos).toEqual([10])
  })
  it('removes by index; out-of-range returns the same reference', () => {
    const s = seq([
      { type: 'setArmor', slot: 'head', armorId: 1 },
      { type: 'addDeco', target: head, decoId: 10 },
      { type: 'addDeco', target: head, decoId: 11 },
    ])
    expect(run(s, { type: 'removeDeco', target: head, index: 0 }).armor.head?.decos).toEqual([11])
    expect(run(s, { type: 'removeDeco', target: head, index: 2 })).toBe(s)
    expect(run(s, { type: 'removeDeco', target: head, index: -1 })).toBe(s)
    expect(run(s, { type: 'removeDeco', target: { kind: 'charm' }, index: 0 })).toBe(s)
  })
})

describe('charm', () => {
  it('a missing charm id behaves as no charm', () => {
    const s = run(emptyBuild(), { type: 'setCharm', charmId: 'gone' })
    expect(capacityOf(s, { kind: 'charm' }, ctx())).toBe(0)
    expect(run(s, { type: 'addDeco', target: { kind: 'charm' }, decoId: 10 })).toBe(s)
  })
  it('trims decorations when the charm disappears or shrinks', () => {
    const s = seq([
      { type: 'setCharm', charmId: 'c1' },
      { type: 'addDeco', target: { kind: 'charm' }, decoId: 10 },
      { type: 'addDeco', target: { kind: 'charm' }, decoId: 10 },
    ])
    expect(s.charm.decos).toEqual([10, 10])
    expect(normalizeBuild(s, ctx([charm(1)])).charm.decos).toEqual([10])
    expect(normalizeBuild(s, ctx([])).charm.decos).toEqual([])
    expect(normalizeBuild(s, ctx())).toBe(s)
    expect(run(s, { type: 'setCharm', charmId: null }).charm.decos).toEqual([])
  })
})

describe('capacity', () => {
  const s = seq([
    { type: 'setWeapon', weapon: { kind: 'data', weaponId: 100 } },
    { type: 'setArmor', slot: 'chest', armorId: 3 },
    { type: 'setCharm', charmId: 'c1' },
  ])
  it('per target kind', () => {
    expect(capacityOf(s, { kind: 'weapon' }, ctx())).toBe(2)
    expect(capacityOf(s, { kind: 'armor', slot: 'chest' }, ctx())).toBe(2)
    expect(capacityOf(s, { kind: 'armor', slot: 'legs' }, ctx())).toBe(0)
    expect(capacityOf(s, { kind: 'charm' }, ctx())).toBe(2)
    expect(capacityOf(emptyBuild(), { kind: 'weapon' }, ctx())).toBe(0)
    expect(capacityOf({ ...s, weapon: { kind: 'slots', slots: 3 } }, { kind: 'weapon' }, ctx())).toBe(3)
  })
  it('canAddDeco reflects fit', () => {
    expect(canAddDeco(s, { kind: 'weapon' }, 11, ctx())).toBe(true)
    expect(canAddDeco(s, { kind: 'weapon' }, 12, ctx())).toBe(false)
    expect(canAddDeco(s, { kind: 'weapon' }, 999, ctx())).toBe(false)
  })
})

describe('other actions', () => {
  it('setArmorLevel and reset', () => {
    const s = run(emptyBuild(), { type: 'setArmorLevel', level: 'max' })
    expect(s.armorLevel).toBe('max')
    expect(run(s, { type: 'reset' })).toEqual(emptyBuild())
  })
})
