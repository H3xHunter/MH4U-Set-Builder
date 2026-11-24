import type { SavedCharm, SkillTree, SlotCount } from '@/data/types'
import { CHARM_NAME_MAX, CHARM_POINTS_LIMIT, MAX_CHARMS, type CharmInput } from './charms'
import { signed } from './rarity'
import { activeTier, type ActiveTier } from './skills'

/** The editor creates and edits this many skills; storage may hold more and the editor then shows all of them. */
export const EDITOR_MAX_SKILLS = 2

export type TreeNameOf = (id: number | string) => string

const slotText = (n: number) => (n === 0 ? 'no slots' : `${n} ${n === 1 ? 'slot' : 'slots'}`)

/** [treeId, points], highest points first (ties by id), so the strongest skill leads. */
export const charmSkillEntries = (c: Pick<SavedCharm, 'skills'>): [string, number][] =>
  Object.entries(c.skills).sort(([ka, a], [kb, b]) => b - a || Number(ka) - Number(kb))

/** "Attack Up +8, Sharpness +5 · 2 slots", or "Slots only · 3 slots". Never uses the custom name. */
export function charmSummary(c: Pick<SavedCharm, 'skills' | 'slots'>, treeName: TreeNameOf): string {
  const entries = charmSkillEntries(c)
  const skills = entries.length === 0 ? 'Slots only' : entries.map(([id, p]) => `${treeName(id)} ${signed(p)}`).join(', ')
  return `${skills} · ${slotText(c.slots)}`
}

/** The custom name when there is one, otherwise the generated summary. */
export const charmLabel = (c: SavedCharm, treeName: TreeNameOf): string => c.name || charmSummary(c, treeName)

/** Next points value in a direction, skipping 0 and staying inside +-CHARM_POINTS_LIMIT. */
export function stepPoints(p: number, dir: 1 | -1): number {
  let n = p + dir
  if (n === 0) n += dir
  return Math.max(-CHARM_POINTS_LIMIT, Math.min(CHARM_POINTS_LIMIT, n))
}

export interface DraftRow {
  skillId: number | null
  points: number
}
export interface CharmDraft {
  name: string
  slots: SlotCount
  rows: DraftRow[]
}

export const emptyDraft = (): CharmDraft => ({ name: '', slots: 0, rows: [] })
export const draftOf = (c: SavedCharm): CharmDraft => ({
  name: c.name,
  slots: c.slots,
  rows: charmSkillEntries(c).map(([id, points]) => ({ skillId: Number(id), points })),
})

/** Only call when draftProblem is null: rows without a skill are skipped. */
export function draftInput(d: CharmDraft): CharmInput {
  const skills: Record<string, number> = {}
  for (const r of d.rows) if (r.skillId !== null) skills[String(r.skillId)] = r.points
  return { name: d.name.trim(), slots: d.slots, skills }
}

/** Why Save is disabled, or null. `isNew` is whether the draft would add a charm to a list of `count`. */
export function draftProblem(d: CharmDraft, count: number, isNew: boolean): string | null {
  if (isNew && count >= MAX_CHARMS) return `The list is full (${MAX_CHARMS} charms). Delete one first.`
  if (d.name.trim().length > CHARM_NAME_MAX) return `The name is longer than ${CHARM_NAME_MAX} characters.`
  if (d.rows.some((r) => r.skillId === null)) return 'Choose a skill for each row, or remove the row.'
  const ids = d.rows.map((r) => r.skillId)
  if (new Set(ids).size !== ids.length) return 'A skill can only appear once on a charm.'
  if (d.rows.some((r) => r.points === 0 || Math.abs(r.points) > CHARM_POINTS_LIMIT)) {
    return `Points must be between -${CHARM_POINTS_LIMIT} and ${CHARM_POINTS_LIMIT}, not 0.`
  }
  if (d.rows.length === 0 && d.slots === 0) return 'Add a skill or at least 1 slot.'
  return null
}

/** The tier this charm alone would reach for one skill (the skill's own thresholds), or null. */
export const charmTier = (tree: SkillTree | undefined, points: number): ActiveTier | null =>
  tree ? activeTier(tree.tiers, points) : null

/** Skills matching the query (case-insensitive substring of the name), by name, minus the excluded ids. */
export function findSkills(trees: readonly SkillTree[], query: string, exclude: readonly number[] = []): SkillTree[] {
  const q = query.trim().toLowerCase()
  return trees
    .filter((t) => !exclude.includes(t.id) && t.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name))
}
