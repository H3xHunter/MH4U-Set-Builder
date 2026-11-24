import type { Weapon } from '@/data/types'

export interface TreeRow {
  weapon: Weapon
  depth: number
  hasChildren: boolean
  parentId: number | null
}

export type TreeIssue =
  | { kind: 'missingParent'; weaponId: number; parentId: number }
  | { kind: 'crossClassParent'; weaponId: number; parentId: number }
  | { kind: 'cycle'; weaponIds: number[] }

export interface WeaponTree {
  /** Depth-first preorder. Weapons that sit on a cycle are absent (see `hasCycle`). */
  rows: TreeRow[]
  issues: TreeIssue[]
  /** The caller should fall back to flatTree() for this class. */
  hasCycle: boolean
}

/**
 * Builds the upgrade tree of ONE class (the JSON has no depth field; depth comes from walking parentId).
 * Roots are weapons whose parentId is null. A weapon whose parent is missing, or in another class, is
 * treated as a root and recorded in `issues`. Pass `allById` (every weapon) to tell those two apart.
 * Children are ordered by id. ASSUMPTION: id order matches the in-game order of siblings; the data does not say.
 */
export function buildWeaponTree(weapons: readonly Weapon[], allById?: ReadonlyMap<number, Weapon>): WeaponTree {
  const inClass = new Map(weapons.map((w) => [w.id, w]))
  const issues: TreeIssue[] = []
  const children = new Map<number, Weapon[]>()
  const roots: Weapon[] = []

  for (const w of weapons) {
    if (w.parentId === null) roots.push(w)
    else if (inClass.has(w.parentId)) {
      const list = children.get(w.parentId) ?? []
      list.push(w)
      children.set(w.parentId, list)
    } else {
      issues.push(
        allById?.has(w.parentId)
          ? { kind: 'crossClassParent', weaponId: w.id, parentId: w.parentId }
          : { kind: 'missingParent', weaponId: w.id, parentId: w.parentId },
      )
      roots.push(w)
    }
  }
  const byId = (a: Weapon, b: Weapon) => a.id - b.id
  roots.sort(byId)
  for (const list of children.values()) list.sort(byId)

  const rows: TreeRow[] = []
  const visit = (w: Weapon, depth: number) => {
    const kids = children.get(w.id) ?? []
    rows.push({ weapon: w, depth, hasChildren: kids.length > 0, parentId: w.parentId })
    for (const k of kids) visit(k, depth + 1)
  }
  for (const r of roots) visit(r, 0)

  // Anything not reached from a root hangs off a cycle.
  if (rows.length < weapons.length) {
    const seen = new Set(rows.map((r) => r.weapon.id))
    issues.push({ kind: 'cycle', weaponIds: weapons.filter((w) => !seen.has(w.id)).map((w) => w.id).sort((a, b) => a - b) })
  }
  return { rows, issues, hasCycle: rows.length < weapons.length }
}

/** False when the data flags no weapon of the class as final (e.g. Insect Glaive), so a final-only view would be empty. */
export const hasFinalForms = (classWeapons: readonly Weapon[]): boolean => classWeapons.some((w) => w.final)

/** Fallback for a class with a broken tree: no hierarchy, rarity descending then name (a UX choice). */
export function flatTree(weapons: readonly Weapon[], issues: TreeIssue[] = []): WeaponTree {
  const sorted = [...weapons].sort(
    (a, b) => b.rarity - a.rarity || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) || a.id - b.id,
  )
  return {
    rows: sorted.map((weapon) => ({ weapon, depth: 0, hasChildren: false, parentId: null })),
    issues,
    hasCycle: false,
  }
}

export interface VisibleRow extends TreeRow {
  /** Shown only because a descendant matches the search. */
  context: boolean
  /** Meaningful when hasChildren: whether the children are currently shown. */
  expanded: boolean
}

export interface ViewOptions {
  collapsed: ReadonlySet<number>
  query: string
  finalOnly: boolean
}

const matches = (w: Weapon, q: string) => w.name.toLowerCase().includes(q)

export function visibleRows(tree: WeaponTree, { collapsed, query, finalOnly }: ViewOptions): VisibleRow[] {
  const q = query.trim().toLowerCase()

  if (finalOnly) {
    return tree.rows
      .filter((r) => r.weapon.final && (q === '' || matches(r.weapon, q)))
      .map((r) => ({ ...r, depth: 0, hasChildren: false, context: false, expanded: false }))
  }

  if (q !== '') {
    const parentOf = new Map(tree.rows.map((r) => [r.weapon.id, r.parentId]))
    const matched = new Set(tree.rows.filter((r) => matches(r.weapon, q)).map((r) => r.weapon.id))
    const included = new Set(matched)
    for (const id of matched) {
      for (let p = parentOf.get(id) ?? null; p !== null && !included.has(p); p = parentOf.get(p) ?? null) included.add(p)
    }
    const hasShownChild = new Set<number>()
    for (const r of tree.rows) if (included.has(r.weapon.id) && r.parentId !== null) hasShownChild.add(r.parentId)
    return tree.rows
      .filter((r) => included.has(r.weapon.id))
      .map((r) => ({ ...r, context: !matched.has(r.weapon.id), expanded: hasShownChild.has(r.weapon.id) }))
  }

  const out: VisibleRow[] = []
  let hideBelow: number | null = null
  for (const r of tree.rows) {
    if (hideBelow !== null) {
      if (r.depth > hideBelow) continue
      hideBelow = null
    }
    const isCollapsed = r.hasChildren && collapsed.has(r.weapon.id)
    out.push({ ...r, context: false, expanded: r.hasChildren && !isCollapsed })
    if (isCollapsed) hideBelow = r.depth
  }
  return out
}

/** Ids of every node with children: pass as `collapsed` for "Collapse all" (an empty set is "Expand all"). */
export const collapsibleIds = (tree: WeaponTree): Set<number> =>
  new Set(tree.rows.filter((r) => r.hasChildren).map((r) => r.weapon.id))

/** Ids of the ancestors of `id`, nearest first. */
export function ancestorIds(tree: WeaponTree, id: number): number[] {
  const parentOf = new Map(tree.rows.map((r) => [r.weapon.id, r.parentId]))
  const out: number[] = []
  for (let p = parentOf.get(id) ?? null; p !== null; p = parentOf.get(p) ?? null) out.push(p)
  return out
}
