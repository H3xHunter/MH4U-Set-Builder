import { describe, expect, it } from 'vitest'
import { loadRealData } from '@/data/real-data-fixture'
import { mkWeapon } from '@/state/fixtures'
import {
  ancestorIds,
  buildWeaponTree,
  collapsibleIds,
  flatTree,
  hasFinalForms,
  visibleRows,
  type ViewOptions,
} from './weaponTree'
import { WEAPON_CLASSES } from './weaponClass'

const open: ViewOptions = { collapsed: new Set(), query: '', finalOnly: false }
const ids = (rows: { weapon: { id: number } }[]) => rows.map((r) => r.weapon.id)

describe('buildWeaponTree (fixtures)', () => {
  // 1 -> (2 -> 4), 3   plus a final leaf
  const ws = [
    mkWeapon(1, 0, { name: 'Root' }),
    mkWeapon(2, 0, { name: 'Sabre', parentId: 1 }),
    mkWeapon(3, 0, { name: 'Axe', parentId: 1, final: true }),
    mkWeapon(4, 0, { name: 'Sabre+', parentId: 2, final: true }),
  ]

  it('is depth-first preorder with depth, children ordered by id', () => {
    const t = buildWeaponTree([ws[3], ws[2], ws[1], ws[0]])
    expect(t.rows.map((r) => [r.weapon.id, r.depth, r.hasChildren])).toEqual([
      [1, 0, true],
      [2, 1, true],
      [4, 2, false],
      [3, 1, false],
    ])
    expect(t.issues).toEqual([])
  })

  it('records a missing parent and treats the weapon as a root', () => {
    const t = buildWeaponTree([mkWeapon(1, 0), mkWeapon(2, 0, { parentId: 99 })])
    expect(t.issues).toEqual([{ kind: 'missingParent', weaponId: 2, parentId: 99 }])
    expect(t.rows.map((r) => [r.weapon.id, r.depth])).toEqual([[1, 0], [2, 0]])
  })

  it('records a cross-class parent when the full lookup is given', () => {
    const other = mkWeapon(50, 0, { class: 'Hammer' })
    const mine = [mkWeapon(1, 0), mkWeapon(2, 0, { parentId: 50 })]
    const t = buildWeaponTree(mine, new Map([...mine, other].map((w) => [w.id, w])))
    expect(t.issues).toEqual([{ kind: 'crossClassParent', weaponId: 2, parentId: 50 }])
    expect(t.hasCycle).toBe(false)
  })

  it('detects a cycle without throwing and lists the ids', () => {
    const t = buildWeaponTree([mkWeapon(1, 0), mkWeapon(2, 0, { parentId: 3 }), mkWeapon(3, 0, { parentId: 2 })])
    expect(t.hasCycle).toBe(true)
    expect(t.issues).toEqual([{ kind: 'cycle', weaponIds: [2, 3] }])
    expect(ids(t.rows)).toEqual([1])
  })

  it('flatTree sorts by rarity descending then name and keeps every weapon', () => {
    const f = flatTree([mkWeapon(1, 0, { rarity: 1, name: 'B' }), mkWeapon(2, 0, { rarity: 5, name: 'Z' }), mkWeapon(3, 0, { rarity: 5, name: 'A' })])
    expect(ids(f.rows)).toEqual([3, 2, 1])
  })

  describe('visibleRows', () => {
    const t = buildWeaponTree(ws)
    it('hides descendants of collapsed nodes and reports expansion', () => {
      const v = visibleRows(t, { ...open, collapsed: new Set([2]) })
      expect(ids(v)).toEqual([1, 2, 3])
      expect(v.find((r) => r.weapon.id === 2)?.expanded).toBe(false)
      expect(ids(visibleRows(t, { ...open, collapsed: collapsibleIds(t) }))).toEqual([1])
      expect(ids(visibleRows(t, open))).toEqual([1, 2, 4, 3])
    })
    it('search keeps matches plus ancestors (as dimmed context), forced expanded', () => {
      const v = visibleRows(t, { ...open, collapsed: collapsibleIds(t), query: 'SABRE+' })
      expect(v.map((r) => [r.weapon.id, r.context, r.expanded])).toEqual([
        [1, true, true],
        [2, true, true],
        [4, false, false],
      ])
    })
    it('finalOnly is flat with depth 0 and combines with search', () => {
      const v = visibleRows(t, { ...open, finalOnly: true })
      expect(v.map((r) => [r.weapon.id, r.depth])).toEqual([[4, 0], [3, 0]])
      expect(ids(visibleRows(t, { ...open, finalOnly: true, query: 'axe' }))).toEqual([3])
    })
    it('ancestorIds is nearest first', () => {
      expect(ancestorIds(t, 4)).toEqual([2, 1])
      expect(ancestorIds(t, 1)).toEqual([])
    })
  })
})

describe('weapon trees (real data)', () => {
  const data = loadRealData()
  const byId = new Map(data.weapons.map((w) => [w.id, w]))

  it.each(WEAPON_CLASSES)('%s: every weapon appears once, roots have no parent, no issues', (cls) => {
    const weapons = data.weapons.filter((w) => w.class === cls)
    const t = buildWeaponTree(weapons, byId)
    expect(t.issues).toEqual([])
    expect(t.hasCycle).toBe(false)
    expect(ids(t.rows).sort((a, b) => a - b)).toEqual(weapons.map((w) => w.id).sort((a, b) => a - b))
    for (const r of t.rows) {
      if (r.depth === 0) expect(r.weapon.parentId).toBeNull()
      else expect(byId.get(r.weapon.parentId!)?.class).toBe(cls)
    }
    expect(visibleRows(t, { ...open, finalOnly: true })).toHaveLength(weapons.filter((w) => w.final).length)
    expect(visibleRows(t, { ...open, collapsed: collapsibleIds(t) }).every((r) => r.depth === 0)).toBe(true)
    expect(visibleRows(t, open)).toHaveLength(weapons.length)
  })

  it('search returns the ancestors of every match', () => {
    const t = buildWeaponTree(data.weapons.filter((w) => w.class === 'Great Sword'), byId)
    const deep = t.rows.find((r) => r.depth >= 3)!
    const v = visibleRows(t, { ...open, query: deep.weapon.name })
    const got = new Set(ids(v))
    expect(got.has(deep.weapon.id)).toBe(true)
    for (const a of ancestorIds(t, deep.weapon.id)) expect(got.has(a)).toBe(true)
    expect(v.filter((r) => r.context).length).toBeGreaterThanOrEqual(ancestorIds(t, deep.weapon.id).length)
  })

  it('hasFinalForms is false only for Insect Glaive, which has no weapon flagged final', () => {
    for (const cls of WEAPON_CLASSES) {
      expect(hasFinalForms(data.weapons.filter((w) => w.class === cls)), cls).toBe(cls !== 'Insect Glaive')
    }
    expect(hasFinalForms([])).toBe(false)
  })
})
