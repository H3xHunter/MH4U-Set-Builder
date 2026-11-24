import type { Armor, ArmorSlot, Decoration, SkillPoints, SkillTree } from '@/data/types'

export interface WornPiece {
  armor: Armor
  decorations: Decoration[]
}

export interface Charm {
  skills: SkillPoints
  decorations: Decoration[]
}

export interface SkillInput {
  pieces: Partial<Record<ArmorSlot, WornPiece>>
  charm: Charm | null
  weaponDecorations: Decoration[]
}

export interface ActiveTier {
  points: number
  name: string
}

export interface SkillRow {
  treeId: number
  armor: number
  charm: number
  torsoUpBase: number
  deco: number
  torsoUpDeco: number
  base: number
  total: number
  baseTier: ActiveTier | null
  totalTier: ActiveTier | null
}

/**
 * Positive p: highest tier with 0 < threshold <= p.
 * Negative p: tier with the most negative threshold such that p <= threshold < 0.
 */
export function activeTier(tiers: readonly ActiveTier[], p: number): ActiveTier | null {
  let best: ActiveTier | null = null
  for (const t of tiers) {
    const hit = p > 0 ? t.points > 0 && t.points <= p : p < 0 && t.points < 0 && p <= t.points
    if (!hit) continue
    if (best === null || (p > 0 ? t.points > best.points : t.points < best.points)) best = t
  }
  return best && { points: best.points, name: best.name }
}

const sumDecos = (decos: readonly Decoration[]): SkillPoints => {
  const out: SkillPoints = {}
  for (const d of decos) for (const [k, v] of Object.entries(d.skills)) out[k] = (out[k] ?? 0) + v
  return out
}

export function computeSkills(input: SkillInput, trees: readonly SkillTree[]): SkillRow[] {
  type Parts = Pick<SkillRow, 'armor' | 'charm' | 'torsoUpBase' | 'deco' | 'torsoUpDeco'>
  const rows = new Map<number, Parts>()
  const add = (skills: SkillPoints, part: keyof Parts, mult = 1) => {
    for (const [k, v] of Object.entries(skills)) {
      const id = Number(k)
      const row = rows.get(id) ?? { armor: 0, charm: 0, torsoUpBase: 0, deco: 0, torsoUpDeco: 0 }
      row[part] += v * mult
      rows.set(id, row)
    }
  }

  const { pieces, charm, weaponDecorations } = input
  const chest = pieces.chest
  let n = 0
  for (const [slot, piece] of Object.entries(pieces)) {
    if (!piece) continue
    add(piece.armor.skills, 'armor')
    add(sumDecos(piece.decorations), 'deco')
    if (slot !== 'chest' && piece.armor.torsoUp) n++
  }
  if (charm) {
    add(charm.skills, 'charm')
    add(sumDecos(charm.decorations), 'deco')
  }
  add(sumDecos(weaponDecorations), 'deco')
  if (chest && n > 0) {
    add(chest.armor.skills, 'torsoUpBase', n)
    add(sumDecos(chest.decorations), 'torsoUpDeco', n)
  }

  const tiersOf = new Map(trees.map((t) => [t.id, t.tiers]))
  return [...rows.entries()]
    .filter(([, r]) => Object.values(r).some((v) => v !== 0))
    .sort(([a], [b]) => a - b)
    .map(([treeId, r]) => {
      const base = r.armor + r.charm + r.torsoUpBase
      const total = base + r.deco + r.torsoUpDeco
      const tiers = tiersOf.get(treeId) ?? []
      return { treeId, ...r, base, total, baseTier: activeTier(tiers, base), totalTier: activeTier(tiers, total) }
    })
}
