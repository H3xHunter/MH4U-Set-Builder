import type { GameData, Material, Rank } from '@/data/types'
import { itemName } from './materials'

/*
 * Where a material comes from, as plain rows for the UI. Pure; no React.
 * Shown: monster drops, gathering, quest rewards, Wyporium trades, arena quests, and a plain Veggie Elder flag.
 * NOT shown: combining (only named in `otherKinds`).
 * Wyporium direction (confirmed by Hex in game, and by the data: see docs/data-format.md): in the source table
 * `item_in_id` is the item the player RECEIVES and `item_out_id` the item they HAND IN. A material gets a Wyporium
 * row only when it is the received side. The data holds no quantities, so none is claimed.
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

/** An arena quest that gives the material (arena quests have no hub, stars or reward slot in the data). */
export interface ArenaRow {
  questName: string
  percentage: number
  stackSize: number
  count: number
}
/** A trade in which the player hands in `handInName` and receives the material. */
export interface WyporiumRow {
  handInItemId: number
  handInName: string
  unlockQuest: { name: string; hub: string | null; stars: number | null } | null
}

export interface SourceView {
  drops: DropRow[]
  gathering: GatherRow[]
  quests: QuestRow[]
  /** Only trades in which this material is the received item; sorted by hand-in name. */
  wyporium: WyporiumRow[]
  arena: ArenaRow[]
  /** The Veggie Elder gives it; nothing more is shown. */
  veggieElder: boolean
  /**
   * 'shown': any of drops, gathering, quest rewards, wyporium, arena or veggie elder.
   * 'otherOnly': none of those, but a combining source. 'none': no source of any kind.
   */
  coverage: 'none' | 'otherOnly' | 'shown'
  /** Plain-words kinds of the sources that are not shown (only Combining). */
  otherKinds: string[]
}

interface Index {
  monsters: Map<number, string>
  locations: Map<number, string>
  quests: Map<number, { name: string; hub: string | null; stars: number | null }>
  arena: Map<number, string>
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
      // Arena quests are a separate id space (kind 'arena'): ids overlap quest ids.
      arena: new Map(data.quests.filter((q) => q.kind === 'arena').map((q) => [q.id, q.name])),
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
  // Validation guarantees every id resolves; the fallback names only keep a bad file from crashing the panel.

  const drops = collapse(
    material.drops.map((d) => {
      return {
        monsterName: idx.monsters.get(d.monsterId) ?? `Monster #${d.monsterId}`,
        condition: d.condition,
        percentage: d.percentage,
        rank: d.rank,
        stackSize: d.stackSize,
      }
    }),
  ).sort(byChance((r) => r.monsterName))

  const gathering = collapse(
    material.gathering.map((g) => {
      return {
        locationName: idx.locations.get(g.locationId) ?? `Location #${g.locationId}`,
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

  const arena = collapse(
    material.sources.arena.map((a) => {
      return { questName: idx.arena.get(a.arenaQuestId) ?? `Arena quest #${a.arenaQuestId}`, percentage: a.percentage, stackSize: a.stackSize }
    }),
  ).sort(byChance((r) => r.questName))

  // Only the received side (itemInId) is a source of this material; the hand-in side is a use, not a source.
  const wyporium: WyporiumRow[] = material.sources.wyporium
    .filter((w) => w.itemInId === material.id)
    .map((w) => {
      const q = w.unlockQuestId === null ? undefined : idx.quests.get(w.unlockQuestId)
      const unlockQuest = w.unlockQuestId === null ? null : (q ?? { name: `Quest #${w.unlockQuestId}`, hub: null, stars: null })
      return { handInItemId: w.itemOutId, handInName: itemName(data, w.itemOutId), unlockQuest }
    })
    .sort((a, b) => (a.handInName < b.handInName ? -1 : a.handInName > b.handInName ? 1 : a.handInItemId - b.handInItemId))

  const veggieElder = material.sources.veggieElder.length > 0
  const otherKinds = material.sources.combining.length > 0 ? ['Combining'] : []
  const shown = drops.length + gathering.length + quests.length + wyporium.length + arena.length > 0 || veggieElder

  return {
    drops,
    gathering,
    quests,
    wyporium,
    arena,
    veggieElder,
    coverage: shown ? 'shown' : otherKinds.length > 0 ? 'otherOnly' : 'none',
    otherKinds,
  }
}
