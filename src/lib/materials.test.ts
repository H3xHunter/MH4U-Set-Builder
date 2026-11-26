/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DATA_FILES } from '@/data/load'
import type { GameData, Item, Material, Weapon, WeaponMaterial } from '@/data/types'
import { validateGameData } from '@/data/validate'
import { emptyBuild, type BuildState } from '@/state/build'
import { mkArmor, mkData, mkWeapon } from '@/state/fixtures'
import {
  availableRoutes,
  buildMaterials,
  defaultRoute,
  effectiveMode,
  MAX_PATH_DEPTH,
  sortRows,
  totalIn,
  weaponChain,
  weaponsById,
  type MaterialOptions,
} from './materials'

const real = validateGameData(
  Object.fromEntries(DATA_FILES.map((n) => [n, JSON.parse(readFileSync(new URL(`../../public/data/${n}.json`, import.meta.url), 'utf8'))])),
)
const wid = (data: GameData, id: number) => {
  const w = data.weapons.find((x) => x.id === id)
  if (!w) throw new Error(`weapon ${id}`)
  return w
}
const withWeapon = (id: number): BuildState => ({ ...emptyBuild(), weapon: { kind: 'data', weaponId: id } })
const pairs = (lines: { itemId: number; quantity: number }[]) => lines.map((l) => [l.itemId, l.quantity])
const OPEN: MaterialOptions = { weaponMode: 'path' }

describe('real data: weapon step and path', () => {
  it('Lacerator Blade (5007): improve only; step excludes the weapon ingredient; path is 5006 create', () => {
    const w = wid(real, 5007)
    expect(availableRoutes(w)).toEqual(['improve'])
    expect(defaultRoute(w)).toBe('improve')
    const r = buildMaterials(withWeapon(5007), real, OPEN)
    expect(r.weaponStep.route).toBe('improve')
    expect(pairs(r.weaponStep.lines)).toEqual([[213, 5], [207, 4], [266, 3]]) // Carbalite, Lightcrystal, Hercudrome
    expect(r.weaponPath.map((s) => [s.weaponId, s.kind])).toEqual([[5006, 'create']])
    expect(pairs(r.weaponPath[0].lines)).toEqual([[209, 3], [206, 15], [205, 10]]) // Firestone, Dragonite, Machalite
    expect(r.issues).toEqual([])
    // totals: path mode adds 5006's create lines, step mode does not (but still reports the chain)
    expect(r.rows.get(205)).toMatchObject({ name: 'Machalite Ore', weaponStep: 0, weaponPath: 10, total: 10 })
    const step = buildMaterials(withWeapon(5007), real, { weaponMode: 'step' })
    expect(step.rows.has(205)).toBe(false)
    expect(step.weaponPath).toEqual([])
    expect(step.weaponPathSteps).toHaveLength(1)
    expect(step.rows.get(213)?.total).toBe(5)
  })

  it('Iron Sword (5001): root, create only, standalone, path empty', () => {
    const w = wid(real, 5001)
    expect(availableRoutes(w)).toEqual(['create'])
    const r = buildMaterials(withWeapon(5001), real, OPEN)
    expect(r.weaponStep.route).toBe('create')
    expect(pairs(r.weaponStep.lines)).toEqual([[203, 3]])
    expect(r.weaponPathSteps).toEqual([])
    expect(r.issues).toEqual([])
  })

  it('Iron Sword+ (5002) has both routes: default create (empty path); improve gives a one-step path', () => {
    const w = wid(real, 5002)
    expect(availableRoutes(w)).toEqual(['create', 'improve'])
    expect(defaultRoute(w)).toBe('create')
    const create = buildMaterials(withWeapon(5002), real, OPEN)
    expect(create.weaponStep.route).toBe('create')
    expect(create.weaponPathSteps).toEqual([])
    const improve = buildMaterials(withWeapon(5002), real, { weaponMode: 'path', route: 'improve' })
    expect(improve.weaponStep.route).toBe('improve')
    expect(improve.weaponPath.map((s) => [s.weaponId, s.kind])).toEqual([[5001, 'create']])
  })

  it('Buster Sword (5003): create that requires 5002 is not standalone; the path continues from 5002', () => {
    const r = buildMaterials(withWeapon(5003), real, OPEN)
    expect(r.weaponStep.route).toBe('create')
    expect(r.weaponStep.requiresWeaponId).toBe(5002)
    // chain: 5003 (create, needs 5002) <- 5002 Iron Sword+ (standalone create, stop)
    expect(r.weaponPath.map((s) => [s.weaponId, s.kind, s.requiresWeaponId])).toEqual([[5002, 'create', null]])
    expect(r.rows.get(203)).toMatchObject({ weaponStep: 8, weaponPath: 5, total: 13 })
  })

  it('Ukanlos Skyflier (7303): improve requires 7302 while parentId is null; no noParent issue', () => {
    expect(wid(real, 7303).parentId).toBeNull()
    const r = buildMaterials(withWeapon(7303), real, OPEN)
    expect(r.weaponStep).toMatchObject({ route: 'improve', requiresWeaponId: 7302 })
    expect(r.weaponPath.map((s) => [s.weaponId, s.kind])).toEqual([[7302, 'create']])
    expect(r.issues).toEqual([])
  })

  it('Dios Katana (5257): improve follows requiresWeapon 5267, not parent 5248', () => {
    const r = buildMaterials(withWeapon(5257), real, { weaponMode: 'path', route: 'improve' })
    const ids = r.weaponPath.map((s) => s.weaponId)
    expect(ids[ids.length - 1]).toBe(5267)
    expect(ids).not.toContain(5248)
    expect(r.weaponPath[0].kind).toBe('create') // the chain starts at a standalone create
    // default route is create (it has create lines): no path
    expect(buildMaterials(withWeapon(5257), real, OPEN).weaponPathSteps).toEqual([])
  })

  it('a weapon with no recipe (5575): no route, empty step, no crash', () => {
    const r = buildMaterials(withWeapon(5575), real, OPEN)
    expect(r.weaponStep).toMatchObject({ weaponId: 5575, route: null, availableRoutes: [], lines: [], requiresWeaponId: null })
    expect(r.weaponPathSteps).toEqual([])
    expect(r.rows.size).toBe(0)
    expect(r.issues).toEqual([])
  })

  it('custom and no weapon contribute nothing', () => {
    for (const weapon of [{ kind: 'slots', slots: 2 }, { kind: 'none' }] as const) {
      const r = buildMaterials({ ...emptyBuild(), weapon }, real, OPEN)
      expect(r.weaponStep.lines).toEqual([])
      expect(r.weaponStep.weaponId).toBeNull()
      expect(r.weaponPathSteps).toEqual([])
      expect(r.rows.size).toBe(0)
    }
  })

  it('an unknown weapon id and an unavailable route are issues, not crashes', () => {
    expect(buildMaterials(withWeapon(99999), real, OPEN).issues).toEqual([{ kind: 'unknownWeapon', weaponId: 99999 }])
    const r = buildMaterials(withWeapon(5001), real, { weaponMode: 'step', route: 'improve' })
    expect(r.issues).toEqual([{ kind: 'routeUnavailable', weaponId: 5001, route: 'improve' }])
    expect(r.weaponStep.route).toBe('create')
  })
})

describe('real data: armor and shared materials', () => {
  const armorBuild = (extra: Partial<BuildState> = {}): BuildState => ({
    ...emptyBuild(),
    armor: { head: null, chest: null, arms: null, waist: null, legs: { armorId: 1953, decos: [] } },
    ...extra,
  })

  it('Alloy Greaves (Machalite x4) + Lacerator path (Machalite x10) = 14 in path mode, 4 in step mode', () => {
    const b = armorBuild({ weapon: { kind: 'data', weaponId: 5007 } })
    const path = buildMaterials(b, real, { weaponMode: 'path' })
    expect(path.rows.get(205)).toMatchObject({ armor: 4, weaponStep: 0, weaponPath: 10, total: 14 })
    expect(path.perArmorPiece).toEqual([
      { slot: 'legs', armorId: 1953, name: 'Alloy Greaves', lines: [{ itemId: 205, quantity: 4 }, { itemId: 204, quantity: 2 }, { itemId: 203, quantity: 2 }] },
    ])
    const step = buildMaterials(b, real, { weaponMode: 'step' })
    expect(step.rows.get(205)).toMatchObject({ armor: 4, weaponPath: 10, total: 4 })
  })

  it('Ravager Blade+ (5006) as the weapon: its own Machalite x10 is a weapon step part', () => {
    const r = buildMaterials(armorBuild({ weapon: { kind: 'data', weaponId: 5006 } }), real, { weaponMode: 'step' })
    expect(r.rows.get(205)).toMatchObject({ armor: 4, weaponStep: 10, weaponPath: 0, total: 14 })
  })

  it('a piece with no recipe is listed as null and contributes nothing', () => {
    const r = buildMaterials({ ...emptyBuild(), armor: { ...emptyBuild().armor, head: { armorId: 2768, decos: [] } } }, real, OPEN)
    expect(r.perArmorPiece).toEqual([{ slot: 'head', armorId: 2768, name: 'High Metal Helm S', lines: null }])
    expect(r.rows.size).toBe(0)
  })

  it('names come from the data (materials first, then items), never from the build', () => {
    const r = buildMaterials(armorBuild(), real, OPEN)
    expect(r.rows.get(205)?.name).toBe('Machalite Ore')
  })
})

describe('fixtures', () => {
  const line = (itemId: number, quantity: number, kind: WeaponMaterial['kind']): WeaponMaterial => ({ itemId, quantity, kind })
  const imp = (id: number, parentId: number | null, over: Partial<Weapon> = {}) =>
    mkWeapon(id, 0, { parentId, materials: [line(1, 1, 'improve')], ...over })
  const data = (weapons: Weapon[], over: Partial<GameData> = {}) =>
    mkData({ weapons, materials: [{ id: 1, name: 'Ore' } as Material], ...over })

  it('a cycle is recorded, nothing throws', () => {
    const d = data([imp(1, 2), imp(2, 1)])
    const r = buildMaterials(withWeapon(1), d, OPEN)
    expect(r.issues).toEqual([{ kind: 'cycle', weaponIds: [1, 2, 1] }])
    expect(r.weaponPath.map((s) => s.weaponId)).toEqual([2])
    expect(buildMaterials(withWeapon(1), data([imp(1, 1)]), OPEN).issues).toEqual([{ kind: 'cycle', weaponIds: [1, 1] }])
  })

  it('a missing parent is recorded', () => {
    const r = buildMaterials(withWeapon(1), data([imp(1, 999)]), OPEN)
    expect(r.issues).toEqual([{ kind: 'missingWeapon', weaponId: 1, missingId: 999 }])
    expect(r.weaponPathSteps).toEqual([])
  })

  it('an improve chain that reaches a root without parent is a noParent issue', () => {
    const r = buildMaterials(withWeapon(2), data([imp(1, null), imp(2, 1)]), OPEN)
    expect(r.issues).toEqual([{ kind: 'noParent', weaponId: 1 }])
    expect(r.weaponPath.map((s) => [s.weaponId, s.kind])).toEqual([[1, 'improve']])
    expect(buildMaterials(withWeapon(1), data([imp(1, null)]), OPEN).issues).toEqual([{ kind: 'noParent', weaponId: 1 }])
  })

  it('a weapon with no recipe on the chain stops it', () => {
    const r = buildMaterials(withWeapon(2), data([mkWeapon(1, 0), imp(2, 1)]), OPEN)
    expect(r.issues).toEqual([{ kind: 'noRecipe', weaponId: 1 }])
    expect(r.weaponPathSteps).toEqual([])
  })

  it('the depth cap stops a long chain', () => {
    const n = MAX_PATH_DEPTH + 10
    const weapons = Array.from({ length: n }, (_, i) => imp(i + 1, i === 0 ? null : i))
    const r = buildMaterials(withWeapon(n), data(weapons), OPEN)
    expect(r.weaponPathSteps).toHaveLength(MAX_PATH_DEPTH)
    expect(r.issues).toEqual([{ kind: 'depthCap', weaponId: n - MAX_PATH_DEPTH - 1 }])
  })

  it('a chain stops at a standalone create, and a create with a required weapon continues', () => {
    const weapons = [
      mkWeapon(1, 0, { materials: [line(1, 2, 'create')] }),
      mkWeapon(2, 0, { parentId: 1, materials: [line(1, 3, 'create')], requiresWeapon: { create: 1, improve: null } }),
      imp(3, 2),
    ]
    const r = buildMaterials(withWeapon(3), data(weapons), OPEN)
    expect(r.weaponPath.map((s) => [s.weaponId, s.kind, s.requiresWeaponId])).toEqual([[1, 'create', null], [2, 'create', 1]])
    expect(r.rows.get(1)).toMatchObject({ weaponStep: 1, weaponPath: 5, total: 6 })
  })

  it('improve is preferred over a create that needs a weapon; a standalone create wins over improve', () => {
    const both = mkWeapon(2, 0, {
      parentId: 1,
      materials: [line(1, 1, 'create'), line(1, 4, 'improve')],
      requiresWeapon: { create: 1, improve: null },
    })
    const root = mkWeapon(1, 0, { materials: [line(1, 7, 'create'), line(1, 9, 'improve')] })
    const r = weaponChain(imp(3, 2), 'improve', weaponsById(data([root, both, imp(3, 2)])))
    expect(r.steps.map((s) => [s.weaponId, s.kind])).toEqual([[1, 'create'], [2, 'improve']])
  })

  it('an unknown item id is an issue and gets a fallback name; an unknown armor id is an issue', () => {
    const d = data([], { armor: [mkArmor(5, 'head', 0, { materials: [{ itemId: 777, quantity: 2, kind: 'create' }] })], items: [{ id: 9, name: 'Item Nine' } as Item] })
    const b: BuildState = { ...emptyBuild(), armor: { ...emptyBuild().armor, head: { armorId: 5, decos: [] }, legs: { armorId: 404, decos: [] } } }
    const r = buildMaterials(b, d, OPEN)
    expect(r.issues).toEqual([{ kind: 'unknownItem', itemId: 777 }, { kind: 'unknownArmor', armorId: 404 }])
    expect(r.rows.get(777)).toMatchObject({ name: 'Item #777', armor: 2, total: 2 })
  })

  it('names fall back from materials to items', () => {
    const d = data([mkWeapon(1, 0, { materials: [line(9, 1, 'create'), line(1, 1, 'create')] })], { items: [{ id: 9, name: 'Item Nine' } as Item, { id: 1, name: 'Shadowed' } as Item] })
    const r = buildMaterials(withWeapon(1), d, OPEN)
    expect(r.rows.get(9)?.name).toBe('Item Nine')
    expect(r.rows.get(1)?.name).toBe('Ore') // materials win
    expect(r.issues).toEqual([])
  })
})

describe('effective mode and totals ordering', () => {
  it('effectiveMode: a path with no steps is always step; the stored choice is not touched', () => {
    expect(effectiveMode('path', 0)).toBe('step')
    expect(effectiveMode('path', 3)).toBe('path')
    expect(effectiveMode('step', 3)).toBe('step')
    expect(effectiveMode('step', 0)).toBe('step')
  })

  const row = (itemId: number, name: string, armor: number, weaponStep: number, weaponPath: number) => ({ itemId, name, armor, weaponStep, weaponPath, total: 0 })

  it('sortRows: total descending in the mode, then name; path quantities count only in path mode; zero totals are dropped', () => {
    const rows = [row(1, 'Beta', 2, 0, 0), row(2, 'Alpha', 1, 0, 1), row(3, 'Gamma', 0, 0, 5), row(4, 'Delta', 2, 0, 0)]
    expect(sortRows(rows, 'step').map((r) => r.name)).toEqual(['Beta', 'Delta', 'Alpha']) // Gamma has only path quantity
    expect(sortRows(rows, 'path').map((r) => [r.name, totalIn(r, 'path')])).toEqual([['Gamma', 5], ['Alpha', 2], ['Beta', 2], ['Delta', 2]])
  })

  it('real build (Ioprey Mail X, Alloy Greaves, Konchu Vambraces X, Lacerator Blade): the order changes between step and path mode', () => {
    const build: BuildState = {
      ...emptyBuild(),
      weapon: { kind: 'data', weaponId: 5007 },
      armor: { head: null, chest: { armorId: 3781, decos: [] }, arms: { armorId: 3754, decos: [] }, waist: null, legs: { armorId: 1953, decos: [] } },
    }
    const m = buildMaterials(build, real, { weaponMode: 'path' })
    const first = (mode: 'step' | 'path') => sortRows(m.rows.values(), mode).slice(0, 5).map((r) => [r.name, totalIn(r, mode)])
    expect(first('step')).toEqual([['Carbalite Ore', 5], ['Konchu Cortex', 5], ['Eltalite Ore', 4], ['Konchu Carapace', 4], ['Lightcrystal', 4]])
    expect(first('path')[0]).toEqual(['Dragonite Ore', 15])
    expect(first('path')[1]).toEqual(['Machalite Ore', 14])
    expect(first('step').map((r) => r[0])).not.toEqual(first('path').map((r) => r[0]))
    expect(sortRows(m.rows.values(), 'step').length).toBe(14)
    expect(sortRows(m.rows.values(), 'path').length).toBe(16)
  })
})
