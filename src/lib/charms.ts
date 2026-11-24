import type { GameData, SavedCharm, SkillPoints, SlotCount } from '@/data/types'

export const CHARMS_KEY = 'mh4u-set-builder:charms'
export const CHARMS_BACKUP_KEY = 'mh4u-set-builder:charms:backup'
export const CHARMS_BACKUP2_KEY = 'mh4u-set-builder:charms:backup2'
export const STORAGE_VERSION = 1
export const MAX_RAW_BYTES = 200 * 1024
export const MAX_CHARMS = 100

// Sanity bounds, NOT confirmed game rules. CHARM_POINTS_LIMIT is the owner's guess at a sane limit for the points
// of one skill on a charm; the real maximum is unverified. Storage tolerates up to 8 skills per charm, the editor makes 2.
export const CHARM_POINTS_LIMIT = 20
const MAX_SKILL_ENTRIES = 8
export const CHARM_NAME_MAX = 40

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export interface CharmIssue {
  /** Index in the stored list, when the issue concerns one entry. */
  index?: number
  reason: string
  /** Browser storage could not be read at all (unavailable or blocked). */
  storage?: true
  /** Only says where the copy of the original went; not a problem with the data itself. */
  backup?: true
}

export interface CharmInput {
  name: string
  slots: number
  skills: Record<string, number>
}

export type CharmResult = { ok: true; charm: SavedCharm } | { ok: false; errors: string[] }
export type CharmListResult = { ok: true; charms: SavedCharm[] } | { ok: false; errors: string[] }

/** Reading `globalThis.localStorage` itself can throw (blocked site data, some private modes). */
function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const reasonOf = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** Validates one charm (id included). Names are opaque text, never interpreted as HTML. */
export function validateCharmInput(data: GameData, input: unknown): CharmResult {
  if (!isObj(input)) return { ok: false, errors: ['charm must be an object'] }
  const errors: string[] = []
  const { id, name, slots, skills } = input

  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    errors.push('id must be 1 to 64 characters of A-Z, a-z, 0-9, _ or -')
  }
  // The name is optional: '' means unnamed (the UI shows a generated summary instead).
  const trimmed = typeof name === 'string' ? name.trim() : ''
  if (typeof name !== 'string' || trimmed.length > CHARM_NAME_MAX) {
    errors.push(`name must be text of at most ${CHARM_NAME_MAX} characters after trimming`)
  }
  if (!Number.isInteger(slots) || (slots as number) < 0 || (slots as number) > 3) {
    errors.push('slots must be an integer from 0 to 3')
  }

  const points: SkillPoints = {}
  if (!isObj(skills)) {
    errors.push('skills must be an object')
  } else {
    const keys = Object.keys(skills)
    if (keys.length > MAX_SKILL_ENTRIES) errors.push(`skills has more than ${MAX_SKILL_ENTRIES} entries`)
    const known = new Set(data.skills.map((t) => String(t.id)))
    for (const k of keys) {
      const v = skills[k]
      if (k === String(data.meta.torsoUpTreeId)) errors.push(`skills.${k}: the Torso Up tree cannot be on a charm`)
      else if (!known.has(k)) errors.push(`skills.${k}: unknown skill tree`)
      else if (!Number.isInteger(v) || v === 0 || Math.abs(v as number) > CHARM_POINTS_LIMIT) {
        errors.push(`skills.${k}: points must be a nonzero integer with absolute value at most ${CHARM_POINTS_LIMIT}`)
      } else points[k] = v as number
    }
  }

  // A slot-only charm (no skills) is valid and intended.
  if (errors.length === 0 && slots === 0 && Object.keys(points).length === 0) {
    errors.push('a charm needs at least 1 slot or at least 1 skill')
  }
  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, charm: { id: id as string, name: trimmed, slots: slots as SlotCount, skills: points } }
}

/** Never throws. Anything dropped or rejected is first copied, verbatim, to the backup key. */
export function loadCharms(
  data: GameData,
  storage: StorageLike | null = defaultStorage(),
): { charms: SavedCharm[]; issues: CharmIssue[] } {
  if (!storage) return { charms: [], issues: [{ reason: 'browser storage is unavailable', storage: true }] }
  let raw: string | null
  try {
    raw = storage.getItem(CHARMS_KEY)
  } catch (e) {
    return { charms: [], issues: [{ reason: `could not read storage: ${reasonOf(e)}`, storage: true }] }
  }
  if (raw === null) return { charms: [], issues: [] }

  const issues: CharmIssue[] = []
  const charms: SavedCharm[] = []
  const rejectAll = (reason: string) => {
    issues.push({ reason })
    return { charms: [], issues: withBackup(storage, raw, issues) }
  }

  if (raw.length > MAX_RAW_BYTES) return rejectAll(`stored charms are larger than ${MAX_RAW_BYTES / 1024} KB`)
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return rejectAll('stored charms are not valid JSON')
  }
  if (!isObj(parsed) || parsed.version !== STORAGE_VERSION) return rejectAll('unknown storage version')
  if (parsed.dataVersion !== data.meta.dataVersion) return rejectAll('charms were saved for a different data version')
  if (!Array.isArray(parsed.charms)) return rejectAll('stored charm list is not an array')

  const seen = new Set<string>()
  parsed.charms.forEach((entry: unknown, index) => {
    const r = validateCharmInput(data, entry)
    if (!r.ok) return void issues.push({ index, reason: r.errors.join('; ') })
    if (seen.has(r.charm.id)) return void issues.push({ index, reason: `duplicate id ${r.charm.id}` })
    if (charms.length >= MAX_CHARMS) return void issues.push({ index, reason: `more than ${MAX_CHARMS} charms` })
    seen.add(r.charm.id)
    charms.push(r.charm)
  })
  return { charms, issues: issues.length > 0 ? withBackup(storage, raw, issues) : issues }
}

/**
 * Keeps a copy of a bad stored value. An existing backup is never overwritten: the first one stays in the
 * backup key, a later different one goes to a second key (which only a later different value replaces).
 */
function withBackup(storage: StorageLike, raw: string, issues: CharmIssue[]): CharmIssue[] {
  try {
    const first = storage.getItem(CHARMS_BACKUP_KEY)
    const key = first === null || first === raw ? CHARMS_BACKUP_KEY : CHARMS_BACKUP2_KEY
    if (first !== raw) storage.setItem(key, raw)
    return [...issues, { reason: 'the original stored value was saved to a backup', backup: true }]
  } catch (e) {
    return [...issues, { reason: `could not save a backup of the original value: ${reasonOf(e)}`, backup: true }]
  }
}

/** What the UI tells the user about a load: unreadable charms (list or entries) and unusable storage. */
export function summarizeIssues(issues: readonly CharmIssue[]): { unreadable: number; storageUnavailable: boolean } {
  return {
    unreadable: issues.filter((i) => !i.backup && !i.storage).length,
    storageUnavailable: issues.some((i) => i.storage),
  }
}

export function saveCharms(
  data: GameData,
  charms: SavedCharm[],
  storage: StorageLike | null = defaultStorage(),
): { ok: true } | { ok: false; reason: string } {
  if (!storage) return { ok: false, reason: 'browser storage is unavailable' }
  try {
    storage.setItem(CHARMS_KEY, JSON.stringify({ version: STORAGE_VERSION, dataVersion: data.meta.dataVersion, charms }))
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: reasonOf(e) }
  }
}

const defaultId = (): string =>
  typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`

export function createCharm(data: GameData, input: CharmInput, makeId: () => string = defaultId): CharmResult {
  return validateCharmInput(data, { ...input, id: makeId() })
}

/** Returns a new list with the charm replaced; the id itself cannot change. */
export function updateCharm(
  data: GameData,
  charms: readonly SavedCharm[],
  id: string,
  changes: Partial<CharmInput>,
): CharmListResult {
  const current = charms.find((c) => c.id === id)
  if (!current) return { ok: false, errors: [`no charm with id ${id}`] }
  const r = validateCharmInput(data, { ...current, ...changes, id })
  if (!r.ok) return r
  return { ok: true, charms: charms.map((c) => (c.id === id ? r.charm : c)) }
}

export const deleteCharm = (charms: readonly SavedCharm[], id: string): SavedCharm[] =>
  charms.filter((c) => c.id !== id)

const listFull = (): CharmListResult => ({ ok: false, errors: [`the charm list is full (${MAX_CHARMS} charms)`] })

/** Appends a new charm; refuses past MAX_CHARMS. */
export function addCharm(
  data: GameData,
  charms: readonly SavedCharm[],
  input: CharmInput,
  makeId?: () => string,
): CharmListResult {
  if (charms.length >= MAX_CHARMS) return listFull()
  const r = createCharm(data, input, makeId)
  return r.ok ? { ok: true, charms: [...charms, r.charm] } : r
}

/** Inserts a copy right after the original. A named charm gets " (copy)" (cut to fit the name limit). */
export function duplicateCharm(
  data: GameData,
  charms: readonly SavedCharm[],
  id: string,
  makeId?: () => string,
): CharmListResult {
  const at = charms.findIndex((c) => c.id === id)
  if (at < 0) return { ok: false, errors: [`no charm with id ${id}`] }
  if (charms.length >= MAX_CHARMS) return listFull()
  const { name, slots, skills } = charms[at]
  const suffix = ' (copy)'
  const copyName = name ? name.slice(0, CHARM_NAME_MAX - suffix.length).trimEnd() + suffix : ''
  const r = createCharm(data, { name: copyName, slots, skills: { ...skills } }, makeId)
  if (!r.ok) return r
  return { ok: true, charms: [...charms.slice(0, at + 1), r.charm, ...charms.slice(at + 1)] }
}
