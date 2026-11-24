import type { Decoration, SkillTree } from '@/data/types'

export interface DecoFilter {
  query: string
  /** 0 = all sizes. */
  size: 0 | 1 | 2 | 3
  onlyFits: boolean
}

/** `fits` should be the build's canAddDeco for the target piece (the single source of truth). */
export function filterDecos(
  decos: readonly Decoration[],
  trees: readonly SkillTree[],
  f: DecoFilter,
  fits: (d: Decoration) => boolean,
): Decoration[] {
  const names = new Map(trees.map((t) => [String(t.id), t.name.toLowerCase()]))
  const q = f.query.trim().toLowerCase()
  return decos
    .filter((d) => {
      if (f.size !== 0 && d.size !== f.size) return false
      if (f.onlyFits && !fits(d)) return false
      if (q === '') return true
      return d.name.toLowerCase().includes(q) || Object.keys(d.skills).some((k) => names.get(k)?.includes(q))
    })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.id - b.id))
}
