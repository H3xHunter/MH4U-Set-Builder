import type { GameData, Material, Rank } from '@/data/types'

/*
 * Where a material comes from, as plain rows for the UI. Pure; no React.
 * Shown: monster drops, gathering, quest rewards. NOT shown (v1): combining, arena, wyporium, veggie elder;
 * only their kinds are named (`otherKinds`).
 * Exact duplicate rows (all fields equal) are collapsed into one row with `count`; nothing is summed or dropped.
 * Order inside drops and gathering: rank G, HR, LR; then chance descending (null last); then name. Quest rewards have
 * no rank: chance descending (null last), then name. It is plain ordering, not a ranking of sources.
 */

const RANK_ORDER: Record<Rank, number> = { G: 0, HR: 1, LR: 2 }

export interface DropRow {
  monsterName: string
  condition: string
  percentage: number | null
  rank: Rank
  stackSize: number
  count: number
}
export interface GatherRow {
  locationName: string
  area: string
  site: string
  rank: Rank
  quantity: number
  percentage: number
  count: number
}
export interface QuestRow {
  questName: string
  hub: string | null
  stars: number | null
  slot: string
  percentage: number
  stackSize: number
  count: number
}

export type SourceIssue =
  | { kind: 'unknownMonster'; id: number }
  | { kind: 'unknownLocation'; id: number }
  | { kind: 'unknownQuest'; id: number }

export interface SourceView {
  drops: DropRow[]
  gathering: GatherRow[]
  quests: QuestRow[]
  /**
   * 'none': no source of any kind. 'otherOnly': only sources v1 does not show (see `otherKinds`).
   * 'shown': at least one drop, gathering or quest row.
   */
  coverage: 'none' | 'otherOnly' | 'shown'
  /** Plain-words kinds of the sources that are not shown, taken from the material's own data. */
  otherKinds: string[]
  issues: SourceIssue[]
}

interface Index {
  monsters: Map<number, string>
  locations: Map<number, string>
  quests: Map<number, { name: string; hub: string | null; stars: number | null }>
}
const indexes = new WeakMap<GameData, Index>()
function indexOf(data: GameData): Index {
  let i = indexes.get(data)
  if (!i) {
    i = {
      monsters: new Map(data.monsters.map((m) => [m.id, m.name])),
      locations: new Map(data.locations.map((l) => [l.id, l.name])),
      // Quest rewards refer to kind 'quest' (arena quests have their own id space and are not shown).
      quests: new Map(data.quests.filter((q) => q.kind === 'quest').map((q) => [q.id, { name: q.name, hub: q.hub, stars: q.stars }])),
    }
    indexes.set(data, i)
  }
  return i
}

/** 0 -> "0%", null -> "?", otherwise the number as stored. */
export const formatChance = (p: number | null): string => (p === null ? '?' : `${p}%`)

function collapse<T extends object>(rows: T[]): (T & { count: number })[] {
  const out = new Map<string, T & { count: number }>()
  for (const r of rows) {
    const key = JSON.stringify(r)
    const hit = out.get(key)
    if (hit) hit.count++
    else out.set(key, { ...r, count: 1 })
  }
  return [...out.values()]
}

const OTHER_KINDS = [
  ['wyporium', 'Wyporium trade'],
  ['arena', 'Arena'],
  ['combining', 'Combining'],
  ['veggieElder', 'Veggie Elder'],
] as const

/** Rank (G, HR, LR) when the rows have one, then chance descending (null last), then name. */
export const byChance =
  <T extends { percentage: number | null; rank?: Rank }>(name: (r: T) => string) =>
  (a: T, b: T): number => {
    if (a.rank !== undefined && b.rank !== undefined && a.rank !== b.rank) return RANK_ORDER[a.rank] - RANK_ORDER[b.rank]
    if (a.percentage !== b.percentage) {
      if (a.percentage === null) return 1
      if (b.percentage === null) return -1
      return b.percentage - a.percentage
    }
    const [x, y] = [name(a), name(b)]
    return x < y ? -1 : x > y ? 1 : 0
  }

export function sourceView(material: Material, data: GameData): SourceView {
  const idx = indexOf(data)
  const issues: SourceIssue[] = []
  const flagged = new Set<string>()
  const flag = (issue: SourceIssue) => {
    const key = `${issue.kind}:${issue.id}`
    if (!flagged.has(key)) {
      flagged.add(key)
      issues.push(issue)
    }
  }

  const drops = collapse(
    material.drops.map((d) => {
      const name = idx.monsters.get(d.monsterId)
      if (name === undefined) flag({ kind: 'unknownMonster', id: d.monsterId })
      return {
        monsterName: name ?? `Monster #${d.monsterId}`,
        condition: d.condition,
        percentage: d.percentage,
        rank: d.rank,
        stackSize: d.stackSize,
      }
    }),
  ).sort(byChance((r) => r.monsterName))

  const gathering = collapse(
    material.gathering.map((g) => {
      const name = idx.locations.get(g.locationId)
      if (name === undefined) flag({ kind: 'unknownLocation', id: g.locationId })
      return {
        locationName: name ?? `Location #${g.locationId}`,
        area: g.area,
        site: g.site,
        rank: g.rank,
        quantity: g.quantity,
        percentage: g.percentage,
      }
    }),
  ).sort(byChance((r) => r.locationName))

  const quests = collapse(
    material.sources.quests.map((q) => {
      const quest = idx.quests.get(q.questId)
      if (quest === undefined) flag({ kind: 'unknownQuest', id: q.questId })
      return {
        questName: quest?.name ?? `Quest #${q.questId}`,
        hub: quest?.hub ?? null,
        stars: quest?.stars ?? null,
        slot: q.slot,
        percentage: q.percentage,
        stackSize: q.stackSize,
      }
    }),
  ).sort(byChance((r) => r.questName))

  const otherKinds = OTHER_KINDS.filter(([key]) => material.sources[key].length > 0).map(([, label]) => label)

  return {
    drops,
    gathering,
    quests,
    coverage: material.drops.length + material.gathering.length + material.sources.quests.length > 0 ? 'shown' : otherKinds.length > 0 ? 'otherOnly' : 'none',
    otherKinds,
    issues,
  }
}
