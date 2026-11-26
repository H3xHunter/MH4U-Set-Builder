/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { validateGameData } from './validate'

const NAMES = ['meta', 'skills', 'armor', 'decorations', 'weapons', 'horn', 'materials', 'monsters', 'locations', 'quests', 'items']

const load = () =>
  validateGameData(
    Object.fromEntries(
      NAMES.map((n) => [n, JSON.parse(readFileSync(new URL(`../../public/data/${n}.json`, import.meta.url), 'utf8'))]),
    ),
  )

describe('public/data', () => {
  it('passes validateGameData and matches meta.counts', () => {
    const data = load()
    for (const [k, v] of Object.entries(data.meta.counts)) expect((data as unknown as Record<string, unknown[]>)[k]).toHaveLength(v)
    expect(data.meta.counts).toMatchObject({ armor: 3087, weapons: 2324, materials: 1096 })
  })

  it('has weapon recipes: 2321 weapons with lines, 3 without, 9186 lines, costs null when absent', () => {
    const { weapons } = load()
    expect(weapons.filter((w) => w.materials.length > 0)).toHaveLength(2321)
    expect(weapons.filter((w) => w.materials.length === 0).map((w) => w.id)).toEqual([5575, 5963, 5965])
    expect(weapons.reduce((n, w) => n + w.materials.length, 0)).toBe(9186)
    expect(weapons.filter((w) => w.creationCost === null)).toHaveLength(1696)
    expect(weapons.filter((w) => w.upgradeCost === null)).toHaveLength(412)
  })

  it('requiresWeapon: every weapon has it; 21 create (all equal parentId), 4 improve that differ from parentId', () => {
    const { weapons } = load()
    expect(weapons.every((w) => w.requiresWeapon !== undefined)).toBe(true)
    const create = weapons.filter((w) => w.requiresWeapon.create !== null)
    expect(create).toHaveLength(21)
    expect(create.every((w) => w.requiresWeapon.create === w.parentId)).toBe(true)
    const improve = weapons.filter((w) => w.requiresWeapon.improve !== null)
    expect(improve.map((w) => [w.id, w.parentId, w.requiresWeapon.improve])).toEqual([
      [5257, 5248, 5267],
      [5694, 5693, 5692],
      [7098, 7097, 7095],
      [7303, null, 7302],
    ])
    const byId = new Map(weapons.map((w) => [w.id, w]))
    expect(byId.get(5003)?.requiresWeapon).toEqual({ create: 5002, improve: null })
    expect(byId.get(5007)?.requiresWeapon).toEqual({ create: null, improve: null }) // normal improve: parentId says it
    for (const id of [5026, 5121, 5465, 5566, 5954, 6171, 6349, 6717, 6916]) {
      expect(byId.get(id)?.requiresWeapon).toEqual({ create: null, improve: null })
    }
  })

  it('Lacerator Blade (5007): improve only, parent weapon not listed', () => {
    const w = load().weapons.find((x) => x.id === 5007)
    expect(w).toMatchObject({ parentId: 5006, creationCost: null, upgradeCost: 20000 })
    expect(w?.materials).toEqual([
      { itemId: 213, quantity: 5, kind: 'improve' },
      { itemId: 207, quantity: 4, kind: 'improve' },
      { itemId: 266, quantity: 3, kind: 'improve' },
    ])
  })
})
