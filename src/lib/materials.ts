import { ARMOR_SLOTS, type ArmorSlot, type GameData, type Weapon } from '@/data/types'
import { armorById, weaponsById, type BuildState } from '@/state/build'

/*
 * Materials of a build. Pure functions; no React, no storage.
 *
 * HEX-APPROVED DESIGN. The game meaning of create vs improve comes from database column names and is UNVERIFIED.
 *
 * Armor: every worn piece contributes its `create` lines. A piece with no recipe contributes nothing and is listed
 * with `lines: null` ("no recipe in the data").
 *
 * Weapon step: the recipe of the equipped weapon for its route. Routes: 'create' (its create lines) and 'improve' (its
 * improve lines). A weapon can have one route or both. GUESS: `defaultRoute` is 'create' when the weapon has create
 * lines, else 'improve' (it gives the shortest path). A weapon with no recipe has no route and an empty step; a custom
 * (N slots) weapon has no materials.
 *
 * A create recipe is STANDALONE when requiresWeapon.create is null: a stopping point of the path. A create recipe
 * with requiresWeapon.create set is not standalone: it needs that weapon, so the path continues from that weapon.
 *
 * Weapon path: the extra steps ABOVE the equipped weapon, ordered from the start of the chain down to the equipped
 * weapon's parent. If the equipped route is a standalone create the path is empty. Otherwise the previous weapon is
 * requiresWeapon[route] when set, else parentId (null ends the path; for an improve route that is an issue, 'noParent').
 * For each previous weapon the step is chosen by: standalone create if it has one (stop), else improve (continue to
 * requiresWeapon.improve ?? parentId), else create with a required weapon (continue to it). A weapon with no recipe on
 * the chain stops it ('noRecipe' issue). Cycles ('cycle') and depth over MAX_PATH_DEPTH ('depthCap') stop the chain.
 * Nothing here throws; problems are returned as issues.
 *
 * Rows carry their three parts (armor, weaponStep, weaponPath). What is shown is decided by `effectiveMode`, `totalIn`
 * and `sortRows`: the path part counts only in 'path' mode, and rows whose shown total is 0 are left out.
 */

export type Route = 'create' | 'improve'
export type WeaponMode = 'step' | 'path'

export const MAX_PATH_DEPTH = 60

export interface RecipeLine {
  itemId: number
  quantity: number
}

export interface PathStep {
  weaponId: number
  name: string
  kind: Route
  lines: RecipeLine[]
  requiresWeaponId: number | null
}

export type MaterialIssue =
  | { kind: 'unknownItem'; itemId: number }
  | { kind: 'unknownWeapon'; weaponId: number }
  | { kind: 'unknownArmor'; armorId: number }
  | { kind: 'unsupportedArmorLine'; armorId: number; lineKind: string }
  | { kind: 'routeUnavailable'; weaponId: number; route: Route }
  | { kind: 'noParent'; weaponId: number }
  | { kind: 'missingWeapon'; weaponId: number; missingId: number }
  | { kind: 'noRecipe'; weaponId: number }
  | { kind: 'cycle'; weaponIds: number[] }
  | { kind: 'depthCap'; weaponId: number }

export interface MaterialRow {
  itemId: number
  name: string
  armor: number
  weaponStep: number
  weaponPath: number
}

export interface BuildMaterials {
  rows: Map<number, MaterialRow>
  perArmorPiece: { slot: ArmorSlot; armorId: number; name: string; lines: RecipeLine[] | null }[]
  weaponStep: {
    weaponId: number | null
    route: Route | null
    availableRoutes: Route[]
    lines: RecipeLine[]
    requiresWeaponId: number | null
  }
  /** Always computed, so the UI can show the chain length without switching modes. */
  weaponPathSteps: PathStep[]
  issues: MaterialIssue[]
}

export interface MaterialOptions {
  /** Route of the equipped weapon; defaults to `defaultRoute`. A route the weapon does not have is an issue and the default is used. */
  route?: Route
}

const nameMaps = new WeakMap<GameData, Map<number, string>>()
/** Name of an item or material (materials win over items); undefined when the id is unknown. */
export function lookupItemName(data: GameData, id: number): string | undefined {
  let m = nameMaps.get(data)
  if (!m) {
    m = new Map([...data.items, ...data.materials].map((x) => [x.id, x.name]))
    nameMaps.set(data, m)
  }
  return m.get(id)
}
export const itemName = (data: GameData, id: number): string => lookupItemName(data, id) ?? `Item #${id}`

const linesOf = (w: Weapon, route: Route): RecipeLine[] =>
  w.materials.filter((m) => m.kind === route).map(({ itemId, quantity }) => ({ itemId, quantity }))

export const availableRoutes = (w: Weapon): Route[] =>
  (['create', 'improve'] as const).filter((r) => w.materials.some((m) => m.kind === r))

/** GUESS: create when the weapon has create lines, else improve (the shortest path); null when it has no recipe. */
export const defaultRoute = (w: Weapon): Route | null => availableRoutes(w)[0] ?? null

const isStandaloneCreate = (w: Weapon) => w.requiresWeapon.create === null && availableRoutes(w).includes('create')

const step = (w: Weapon, kind: Route): PathStep => ({
  weaponId: w.id,
  name: w.name,
  kind,
  lines: linesOf(w, kind),
  requiresWeaponId: w.requiresWeapon[kind],
})

/** The steps above `weapon` for `route`, from the start of the chain to the weapon's predecessor. */
export function weaponChain(
  weapon: Weapon,
  route: Route | null,
  byId: ReadonlyMap<number, Weapon>,
): { steps: PathStep[]; issues: MaterialIssue[] } {
  const issues: MaterialIssue[] = []
  if (route === null || (route === 'create' && weapon.requiresWeapon.create === null)) return { steps: [], issues }

  const found: PathStep[] = []
  const seen = [weapon.id]
  const nextOf = (w: Weapon, kind: Route): number | null => {
    const next = w.requiresWeapon[kind] ?? w.parentId
    if (next === null && kind === 'improve') issues.push({ kind: 'noParent', weaponId: w.id })
    return next
  }

  let nextId = nextOf(weapon, route)
  while (nextId !== null) {
    const w = byId.get(nextId)
    if (!w) {
      issues.push({ kind: 'missingWeapon', weaponId: seen[seen.length - 1], missingId: nextId })
      break
    }
    if (seen.includes(w.id)) {
      issues.push({ kind: 'cycle', weaponIds: [...seen.slice(seen.indexOf(w.id)), w.id] })
      break
    }
    if (found.length >= MAX_PATH_DEPTH) {
      issues.push({ kind: 'depthCap', weaponId: w.id })
      break
    }
    const routes = availableRoutes(w)
    seen.push(w.id)
    if (isStandaloneCreate(w)) {
      found.push(step(w, 'create'))
      break
    }
    if (routes.includes('improve')) {
      found.push(step(w, 'improve'))
      nextId = nextOf(w, 'improve')
    } else if (routes.includes('create')) {
      found.push(step(w, 'create'))
      nextId = w.requiresWeapon.create
    } else {
      issues.push({ kind: 'noRecipe', weaponId: w.id })
      break
    }
  }
  return { steps: found.reverse(), issues }
}

export function buildMaterials(build: BuildState, data: GameData, options: MaterialOptions = {}): BuildMaterials {
  const weapons = weaponsById(data)
  const armors = armorById(data)
  const issues: MaterialIssue[] = []
  const rows = new Map<number, MaterialRow>()
  const unknown = new Set<number>()

  const add = (lines: RecipeLine[], part: 'armor' | 'weaponStep' | 'weaponPath') => {
    for (const { itemId, quantity } of lines) {
      let row = rows.get(itemId)
      if (!row) {
        if (lookupItemName(data, itemId) === undefined && !unknown.has(itemId)) {
          unknown.add(itemId)
          issues.push({ kind: 'unknownItem', itemId })
        }
        row = { itemId, name: itemName(data, itemId), armor: 0, weaponStep: 0, weaponPath: 0 }
        rows.set(itemId, row)
      }
      row[part] += quantity
    }
  }

  const perArmorPiece: BuildMaterials['perArmorPiece'] = []
  for (const slot of ARMOR_SLOTS) {
    const sel = build.armor[slot]
    if (!sel) continue
    const armor = armors.get(sel.armorId)
    if (!armor) {
      issues.push({ kind: 'unknownArmor', armorId: sel.armorId })
      continue
    }
    for (const m of armor.materials) {
      if (m.kind !== 'create') issues.push({ kind: 'unsupportedArmorLine', armorId: armor.id, lineKind: m.kind })
    }
    const lines = armor.materials.filter((m) => m.kind === 'create').map(({ itemId, quantity }) => ({ itemId, quantity }))
    perArmorPiece.push({ slot, armorId: armor.id, name: armor.name, lines: lines.length > 0 ? lines : null })
    add(lines, 'armor')
  }

  const weapon = build.weapon.kind === 'data' ? (weapons.get(build.weapon.weaponId) ?? null) : null
  if (build.weapon.kind === 'data' && !weapon) issues.push({ kind: 'unknownWeapon', weaponId: build.weapon.weaponId })

  let weaponPathSteps: PathStep[] = []
  const weaponStep: BuildMaterials['weaponStep'] = {
    weaponId: weapon?.id ?? null,
    route: null,
    availableRoutes: [],
    lines: [],
    requiresWeaponId: null,
  }
  if (weapon) {
    weaponStep.availableRoutes = availableRoutes(weapon)
    let route = defaultRoute(weapon)
    if (options.route !== undefined) {
      if (weaponStep.availableRoutes.includes(options.route)) route = options.route
      else issues.push({ kind: 'routeUnavailable', weaponId: weapon.id, route: options.route })
    }
    weaponStep.route = route
    if (route !== null) {
      weaponStep.lines = linesOf(weapon, route)
      weaponStep.requiresWeaponId = weapon.requiresWeapon[route]
    }
    const chain = weaponChain(weapon, route, weapons)
    weaponPathSteps = chain.steps
    issues.push(...chain.issues)
    add(weaponStep.lines, 'weaponStep')
    for (const s of weaponPathSteps) add(s.lines, 'weaponPath')
  }

  return { rows, perArmorPiece, weaponStep, weaponPathSteps, issues }
}

/** The stored mode, except that a path with no steps is always 'step' (the stored choice is left alone by the caller). */
export const effectiveMode = (stored: WeaponMode, pathSteps: number): WeaponMode => (stored === 'path' && pathSteps > 0 ? 'path' : 'step')

/** The main quantity of a row: the path part counts only in 'path' mode. */
export const totalIn = (row: MaterialRow, mode: WeaponMode): number => row.armor + row.weaponStep + (mode === 'path' ? row.weaponPath : 0)

/** Rows with a positive total in this mode, largest total first, then name ascending (then item id). */
export function sortRows(rows: Iterable<MaterialRow>, mode: WeaponMode): MaterialRow[] {
  return [...rows]
    .filter((r) => totalIn(r, mode) > 0)
    .sort((a, b) => totalIn(b, mode) - totalIn(a, mode) || (a.name < b.name ? -1 : a.name > b.name ? 1 : a.itemId - b.itemId))
}
