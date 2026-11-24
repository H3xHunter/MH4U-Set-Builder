import type { Armor, ArmorSlot, SkillTree } from '@/data/types'

export type ClassFilter = 'blade' | 'gunner' | 'all'

export interface ArmorFilter {
  slot: ArmorSlot
  query: string
  cls: ClassFilter
  /** Skill tree id: the piece needs positive points in it. */
  skillId: number | null
  /** 0 = any. */
  minSlots: 0 | 1 | 2 | 3
}

/** A null hunterType (blank in the source) matches every class filter, so such a piece is never hidden. */
export const matchesClass = (hunterType: Armor['hunterType'], cls: ClassFilter): boolean =>
  cls === 'all' || hunterType === null || hunterType === 'both' || hunterType === cls

/** Default order is a UX choice, not a game rule: rarity descending, then name, then id. */
export const byRarityThenName = (a: Armor, b: Armor): number =>
  b.rarity - a.rarity || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) || a.id - b.id

/** Plain substring match on lowercased text; user input is never turned into a regex. */
export function filterArmor(armor: readonly Armor[], trees: readonly SkillTree[], f: ArmorFilter): Armor[] {
  const names = new Map(trees.map((t) => [String(t.id), t.name.toLowerCase()]))
  const q = f.query.trim().toLowerCase()
  const skillKey = f.skillId === null ? null : String(f.skillId)
  return armor
    .filter((a) => {
      if (a.slot !== f.slot || !matchesClass(a.hunterType, f.cls) || a.slots < f.minSlots) return false
      if (skillKey !== null && !((a.skills[skillKey] ?? 0) > 0)) return false
      if (q === '') return true
      return a.name.toLowerCase().includes(q) || Object.keys(a.skills).some((k) => names.get(k)?.includes(q))
    })
    .sort(byRarityThenName)
}
