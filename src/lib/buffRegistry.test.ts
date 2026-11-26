import { describe, expect, it } from 'vitest'
import { loadRealData } from '@/data/real-data-fixture'
import type { Weapon } from '@/data/types'
import { mkWeapon } from '@/state/fixtures'
import { BUFF_ID_PATTERN, BUFFS, EFFECT_TYPES, type Buff } from './buffRegistry'
import { calculateDamage, defaultToggles, DEFAULT_TOGGLES, FORMULA_ORDER, listToggles, parseToggles } from './damage'

const data = loadRealData()
const real = (id: number): Weapon => {
  const w = data.weapons.find((x) => x.id === id)
  if (!w) throw new Error(`weapon ${id}`)
  return w
}
const trees = new Map(data.skills.map((t) => [t.id, t]))
const WHITE = { base: [0, 0, 0, 0, 0, 1, 0], plus: [0, 0, 0, 0, 0, 1, 0] } as Weapon['sharpness']

describe('registry integrity', () => {
  it('ids are unique and valid', () => {
    const ids = BUFFS.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id, id).toMatch(BUFF_ID_PATTERN)
  })

  it('every skill tree id and tier exists in the skills data', () => {
    const skillBuffs = BUFFS.filter((b) => b.skill)
    expect(skillBuffs.length).toBeGreaterThan(15)
    for (const b of skillBuffs) {
      const tree = trees.get(b.skill?.tree ?? -1)
      expect(tree, `${b.id}: tree ${b.skill?.tree}`).toBeDefined()
      const have = new Set(tree?.tiers.map((t) => t.points))
      for (const t of b.skill?.tiers ?? []) expect(have.has(t), `${b.id}: tree ${tree?.name} has no tier ${t}`).toBe(true)
    }
  })

  it('every skill tier has a value (a negative tier uses the value of its positive tier)', () => {
    for (const b of BUFFS.filter((x) => x.skill)) {
      for (const e of b.effects.filter((x) => EFFECT_TYPES[x.type] !== 'flag')) {
        expect(typeof e.value, `${b.id} ${e.type}`).toBe('object')
        for (const t of b.skill?.tiers ?? []) expect((e.value as Record<number, number>)[Math.abs(t)], `${b.id} ${e.type} tier ${t}`).toBeTypeOf('number')
      }
    }
  })

  it('effects: known types, flags carry no value, other types carry one, non-skill values are numbers', () => {
    for (const b of BUFFS) {
      for (const e of b.effects) {
        expect(Object.keys(EFFECT_TYPES), `${b.id}: ${e.type}`).toContain(e.type)
        if (EFFECT_TYPES[e.type] === 'flag') expect(e.value, b.id).toBeUndefined()
        else {
          expect(e.value, b.id).toBeDefined()
          if (!b.skill) expect(typeof e.value, b.id).toBe('number')
        }
        expect(e.group, b.id).toMatch(/^[A-Za-z0-9:_.-]+$/)
      }
    }
  })

  it('every effect type is handled by the formula, in a fixed order with no repeats', () => {
    expect([...FORMULA_ORDER].sort()).toEqual(Object.keys(EFFECT_TYPES).sort())
    expect(new Set(FORMULA_ORDER).size).toBe(FORMULA_ORDER.length)
    for (const b of BUFFS) for (const e of b.effects) expect(FORMULA_ORDER).toContain(e.type)
  })

  it('groups are consistent: one element restriction per (type, group); `needs` point at real buffs', () => {
    const seen = new Map<string, string | undefined>()
    for (const b of BUFFS) {
      for (const e of b.effects) {
        const key = `${e.type}|${e.group}`
        if (seen.has(key)) expect(seen.get(key), key).toBe(e.element)
        seen.set(key, e.element)
        for (const n of e.needs ?? []) expect(BUFFS.map((x) => x.id), `${b.id} needs ${n}`).toContain(n)
      }
    }
  })

  it('the (Ele) Atk buffs map to the five element trees by name', () => {
    const ele = BUFFS.filter((b) => b.effects.some((e) => e.type === 'elementMult'))
    expect(Object.fromEntries(ele.map((b) => [b.effects[0].element, trees.get(b.skill?.tree ?? -1)?.name]))).toEqual({
      Fire: 'Fire Atk',
      Water: 'Water Atk',
      Thunder: 'ThunderAtk',
      Ice: 'Ice Atk',
      Dragon: 'Dragon Atk',
    })
  })

  it('the skills the registry names are the ones the owner meant', () => {
    const name = (id: string) => trees.get(BUFFS.find((b) => b.id === id)?.skill?.tree ?? -1)?.name
    expect(
      ['skill:attack', 'skill:edgemaster', 'skill:challenger', 'skill:expert', 'skill:brutality', 'skill:elemental', 'skill:amplify', 'skill:arcana', 'skill:awaken', 'skill:handicraft', 'skill:tenderizer', 'skill:status'].map(name),
    ).toEqual(['Attack', 'Edgemaster', 'Spirit', 'Expert', 'Brutality', 'Elemental', 'Amplify', 'Arcana', 'FreeElemnt', 'Handicraft', 'Tenderizer', 'Status'])
  })

  it('defaults: Powercharm, Powertalon, every skill, songs and kinsect on; combinations have no toggle', () => {
    expect(DEFAULT_TOGGLES).toMatchObject({ 'item:powercharm': true, 'item:powertalon': true, 'skill:challenger': true, 'song:attack-l': true, 'kinsect:orange': true })
    for (const b of BUFFS.filter((x) => x.skill)) expect(DEFAULT_TOGGLES[b.id], b.id).toBe(true)
    expect(Object.keys(DEFAULT_TOGGLES)).not.toContain('kinsect:triple')
    expect(DEFAULT_TOGGLES).toEqual(defaultToggles())
  })
})

describe('adding a buff needs no formula change', () => {
  const extra: Buff = {
    id: 'item:test-flat',
    label: 'Test',
    source: 'item',
    toggle: { default: false },
    effects: [{ type: 'rawFlat', group: 'raw-flat:test', value: 10 }],
  }
  const gs = real(5014)
  const run = (registry: readonly Buff[], on: Record<string, boolean>) => {
    const r = calculateDamage({ weapon: gs, skills: {}, toggles: { ...defaultToggles(registry), 'item:powercharm': false, 'item:powertalon': false, ...on } }, registry)
    if (!r.ok) throw new Error(r.reason)
    return r
  }

  it('a new rawFlat buff changes EFR when on, and not when off', () => {
    const registry = [...BUFFS, extra]
    const base = run(registry, {})
    expect(base.rawBeforeSong).toBe(240)
    const on = run(registry, { 'item:test-flat': true })
    expect(on.rawBeforeSong).toBe(250)
    expect(on.efrTrue).toBeCloseTo(250 * 1.32 * 1.075, 6)
    expect(listToggles(gs, {}, registry).find((g) => g.source === 'item')?.buffs.map((b) => b.id)).toContain('item:test-flat')
  })

  it('a new buff in an existing group takes part in the best-wins rule', () => {
    const registry = [...BUFFS, { ...extra, effects: [{ type: 'rawFlat', group: 'raw-flat:attack', value: 30 }] } as Buff]
    expect(run(registry, { 'item:test-flat': true }).rawBeforeSong).toBe(270)
    const r = calculateDamage({ weapon: gs, skills: { 31: 20 }, toggles: { ...defaultToggles(registry), 'item:powercharm': false, 'item:powertalon': false, 'item:test-flat': true } }, registry)
    expect(r.ok && r.rawBeforeSong).toBe(270) // best of +20 and +30, not +50
  })
})

describe('parseToggles', () => {
  it('non-objects give the defaults', () => {
    for (const junk of [undefined, null, 5, 'x', true, [], [true], () => 1]) expect(parseToggles(junk)).toEqual(DEFAULT_TOGGLES)
  })

  it('keeps only known ids with boolean values', () => {
    const out = parseToggles({ 'item:powercharm': true, 'skill:challenger': false, 'song:attack-l': 'no', 'kinsect:red': 1, nope: true, 'item:powertalon': null })
    expect(out).toEqual({ ...DEFAULT_TOGGLES, 'item:powercharm': true, 'skill:challenger': false })
    expect(Object.keys(out)).toEqual(Object.keys(DEFAULT_TOGGLES))
  })

  it('drops prototype-pollution keys and does not touch Object.prototype', () => {
    const out = parseToggles(JSON.parse('{"__proto__": {"polluted": true}, "constructor": true, "prototype": true, "item:powercharm": true}'))
    expect(out).toEqual({ ...DEFAULT_TOGGLES, 'item:powercharm': true })
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype)
  })

  it('only looks at a capped number of keys', () => {
    const many: Record<string, boolean> = {}
    for (let i = 0; i < 1000; i++) many[`junk${i}`] = true
    many['item:powercharm'] = true // key number 1001: past the cap
    expect(parseToggles(many)).toEqual(DEFAULT_TOGGLES)
  })

  it('never throws on a hostile object', () => {
    const hostile = new Proxy({}, { ownKeys: () => { throw new Error('boom') } })
    expect(parseToggles(hostile)).toEqual(DEFAULT_TOGGLES)
    expect(parseToggles(Object.create({ 'item:powercharm': true }))).toEqual(DEFAULT_TOGGLES) // not a plain object
  })

  it('accepts a null-prototype object', () => {
    expect(parseToggles(Object.assign(Object.create(null), { 'item:powercharm': true }))).toEqual({ ...DEFAULT_TOGGLES, 'item:powercharm': true })
  })
})

describe('listToggles', () => {
  const ids = (g: ReturnType<typeof listToggles>[number]) => g.buffs.map((b) => b.id)

  it('Great Sword: items only; Challenger appears once the skill has a tier', () => {
    const gs = real(5014)
    expect(listToggles(gs, {}).map((g) => [g.source, ids(g)])).toEqual([['item', ['item:powercharm', 'item:powertalon']]])
    expect(listToggles(gs, { 26: 9 }).map((g) => g.source)).toEqual(['item'])
    const withChallenger = listToggles(gs, { 26: 10 })
    expect(withChallenger.map((g) => g.source)).toEqual(['skill', 'item'])
    expect(withChallenger[0].buffs).toEqual([{ id: 'skill:challenger', label: 'Challenger', condition: 'raged monster', default: true }])
    expect(withChallenger[1].buffs.map((b) => b.default)).toEqual([true, true])
  })

  it('Hunting Horn: items and the four songs', () => {
    const h = real(5984)
    expect(listToggles(h, {}).map((g) => [g.source, ids(g)])).toEqual([
      ['item', ['item:powercharm', 'item:powertalon']],
      ['song', ['song:attack-s', 'song:attack-l', 'song:affinity', 'song:element']],
    ])
  })

  it('Insect Glaive: items and the three kinsect toggles, not the hidden combinations', () => {
    const ig = mkWeapon(1, 0, { class: 'Insect Glaive', attack: 744, sharpness: WHITE })
    expect(listToggles(ig, {}).map((g) => [g.source, ids(g)])).toEqual([
      ['item', ['item:powercharm', 'item:powertalon']],
      ['kinsect', ['kinsect:red', 'kinsect:white', 'kinsect:orange']],
    ])
    expect(listToggles(real(6746), {}).map((g) => g.source)).toEqual(['item', 'kinsect'])
  })

  it('a gunner still lists the items', () => {
    expect(listToggles(mkWeapon(1, 0, { class: 'Bow' }), {}).map((g) => g.source)).toEqual(['item'])
  })
})
