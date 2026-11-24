import type { SkillTree } from '@/data/types'
import { activeTier, type ActiveTier, type SkillRow } from './skills'

// Pure view-model for the skills panel: bar geometry, tick states, hint text, row ordering.
// All percentages are positions on the bar (0 = left end, 100 = right end).

export type TickState = 'base' | 'deco' | 'none' | 'active' | 'cleared'
export type SegmentKind = 'base' | 'torso' | 'deco' | 'decoNegative' | 'penalty'

export interface BarInput {
  /** Tier thresholds, ascending (negative allowed). */
  thresholds: readonly number[]
  /** Armor + charm points (base without the Torso Up part). */
  shownBase: number
  /** The Torso Up part of the base. */
  torsoUp: number
  /** Decoration delta (decorations plus Torso Up decorations); may be negative. Implied by base and total. */
  deco?: number
  base: number
  total: number
}

export interface Tick {
  threshold: number
  pct: number
  state: TickState
  labelVisible: boolean
}
export interface Segment {
  kind: SegmentKind
  fromPct: number
  toPct: number
}
export interface BarModel {
  min: number
  max: number
  zeroPct: number
  ticks: Tick[]
  segments: Segment[]
  rail?: { fromPct: number; toPct: number }
  overMax: number
  underMin: number
  topReached: boolean
  /** True when the scale has negative thresholds: the 0 label is always shown then. */
  zeroLabel: boolean
}

/** Labels closer than this (percent of the bar) to a visible label are hidden. A guess, not from the design. */
export const LABEL_MIN_GAP = 8
/** With no positive threshold the bar ends this fraction of the span past zero. */
const NEGATIVE_ONLY_TAIL = 0.06

export function skillBarModel(input: BarInput): BarModel {
  const { thresholds, shownBase, torsoUp, base, total } = input
  const sorted = [...thresholds].sort((a, b) => a - b)
  const deepest = sorted.length > 0 ? sorted[0] : 0
  const highest = sorted.length > 0 ? sorted[sorted.length - 1] : 0
  const hasNegative = deepest < 0
  const hasPositive = highest > 0

  const min = hasNegative ? deepest : 0
  const max = hasPositive ? highest : hasNegative ? NEGATIVE_ONLY_TAIL * -deepest : 0
  const pct = (v: number) => (max === min ? 0 : Math.max(0, Math.min(1, (v - min) / (max - min))) * 100)

  const ticks: Tick[] = sorted.map((threshold) => ({
    threshold,
    pct: pct(threshold),
    state:
      threshold < 0
        ? total <= threshold
          ? 'active'
          : base <= threshold
            ? 'cleared'
            : 'none'
        : base >= threshold
          ? 'base'
          : total >= threshold
            ? 'deco'
            : 'none',
    labelVisible: false,
  }))

  // Labels: the 0 label and the last tick are always shown; the others only if 8% clear of every shown label.
  const shown: number[] = []
  if (hasNegative) shown.push(pct(0))
  if (ticks.length > 0) {
    ticks[ticks.length - 1].labelVisible = true
    shown.push(ticks[ticks.length - 1].pct)
  }
  for (const t of ticks) {
    if (t.labelVisible) continue
    if (shown.every((p) => Math.abs(p - t.pct) >= LABEL_MIN_GAP)) {
      t.labelVisible = true
      shown.push(t.pct)
    }
  }

  const segments: Segment[] = []
  const seg = (kind: SegmentKind, a: number, b: number) => {
    const fromPct = pct(Math.min(a, b))
    const toPct = pct(Math.max(a, b))
    if (toPct > fromPct) segments.push({ kind, fromPct, toPct })
  }

  // Solid part: the overlap of [0, base] and [0, total] on the same side of zero.
  if (base > 0 && total > 0) {
    const solid = Math.min(base, total)
    const armorEnd = Math.max(0, Math.min(shownBase, solid))
    seg('base', 0, armorEnd)
    if (torsoUp > 0) seg('torso', armorEnd, solid)
    else seg('base', armorEnd, solid)
  } else if (base < 0 && total < 0) {
    seg('penalty', Math.max(base, total), 0)
  }
  // The decoration delta is the interval between base and total.
  if (total !== base) seg(total > base ? 'deco' : 'decoNegative', base, total)
  // A negative base that decorations carried to zero or beyond keeps a thin rail under the bar.
  const rail = base < 0 && total >= 0 ? { fromPct: pct(base), toPct: pct(0) } : undefined

  return {
    min,
    max,
    zeroPct: pct(0),
    ticks,
    segments,
    rail,
    overMax: hasPositive ? Math.max(0, total - highest) : 0,
    underMin: hasNegative ? Math.max(0, deepest - total) : 0,
    topReached: hasPositive && total >= highest,
    zeroLabel: hasNegative,
  }
}

export interface TierInfo {
  points: number
  name: string
}
export type HintKind = 'next' | 'top' | 'clear' | 'from' | 'none'
export interface Hint {
  kind: HintKind
  text: string
  /** Only for the positive "Next" form, when exactly one point is missing (amber in the design). */
  near: boolean
}

const points = (n: number) => `${n} ${n === 1 ? 'point' : 'points'}`

export function skillHint({ tiers, total }: { tiers: readonly TierInfo[]; total: number }): Hint {
  const sorted = [...tiers].sort((a, b) => a.points - b.points)
  const positive = sorted.filter((t) => t.points > 0)
  const negative = sorted.filter((t) => t.points < 0)

  if (total < 0) {
    const active = activeTier(sorted, total)
    if (active) {
      const n = active.points + 1 - total
      return { kind: 'clear', text: `${n} more ${n === 1 ? 'point' : 'points'} clear ${active.name}`, near: false }
    }
    if (positive.length === 0 && negative.length > 0) {
      const next = negative[negative.length - 1] // closest to zero
      return { kind: 'from', text: `${points(total - next.points)} from ${next.name}`, near: false }
    }
  }
  if (positive.length > 0) {
    if (total >= positive[positive.length - 1].points) return { kind: 'top', text: 'Top tier reached', near: false }
    const next = positive.find((t) => t.points > total)!
    const n = next.points - total
    return {
      kind: 'next',
      text: `Next: ${next.name} at ${next.points} · ${n} more ${n === 1 ? 'point' : 'points'}`,
      near: n === 1,
    }
  }
  return { kind: 'none', text: '', near: false }
}

export interface SkillView {
  treeId: number
  name: string
  tiers: TierInfo[]
  shownBase: number
  torsoUp: number
  /** Decorations plus Torso Up decorations. */
  deco: number
  base: number
  total: number
  baseTier: ActiveTier | null
  totalTier: ActiveTier | null
  bar: BarModel
  hint: Hint
}

export function buildSkillView(i: {
  treeId: number
  name: string
  tiers: readonly TierInfo[]
  shownBase: number
  torsoUp: number
  deco: number
}): SkillView {
  const tiers = [...i.tiers].sort((a, b) => a.points - b.points)
  const base = i.shownBase + i.torsoUp
  const total = base + i.deco
  return {
    treeId: i.treeId,
    name: i.name,
    tiers,
    shownBase: i.shownBase,
    torsoUp: i.torsoUp,
    deco: i.deco,
    base,
    total,
    baseTier: activeTier(tiers, base),
    totalTier: activeTier(tiers, total),
    bar: skillBarModel({ thresholds: tiers.map((t) => t.points), shownBase: i.shownBase, torsoUp: i.torsoUp, deco: i.deco, base, total }),
    hint: skillHint({ tiers, total }),
  }
}

/** Shown base = base minus Torso Up; "(+x)" = deco + Torso Up deco; TU = torsoUpBase. Sorted by total descending, then name. */
export function skillRows(rows: readonly SkillRow[], trees: readonly SkillTree[]): SkillView[] {
  const byId = new Map(trees.map((t) => [t.id, t]))
  return rows
    .filter((r) => r.base !== 0 || r.total !== 0)
    .map((r) => {
      const tree = byId.get(r.treeId)
      return buildSkillView({
        treeId: r.treeId,
        name: tree?.name ?? `#${r.treeId}`,
        tiers: tree?.tiers.map((t) => ({ points: t.points, name: t.name })) ?? [],
        shownBase: r.base - r.torsoUpBase,
        torsoUp: r.torsoUpBase,
        deco: r.deco + r.torsoUpDeco,
      })
    })
    .sort((a, b) => b.total - a.total || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
}

export function summarizeSkills(rows: readonly SkillView[]): { active: number; near: number } {
  return { active: rows.filter((r) => r.totalTier !== null).length, near: rows.filter((r) => r.hint.near).length }
}

/** U+2212 instead of a hyphen for negative numbers. */
export const formatPoints = (n: number): string => (n < 0 ? `−${-n}` : String(n))
export const formatSigned = (n: number): string => (n > 0 ? `+${n}` : formatPoints(n))

/** Words for screen readers: base, Torso Up, decorations, total, active tier and the hint. */
export function skillAriaLabel(v: SkillView): string {
  const parts = [`${v.name}: base ${formatPoints(v.shownBase)}`]
  if (v.torsoUp !== 0) parts.push(`Torso Up ${formatSigned(v.torsoUp)}`)
  if (v.deco !== 0) parts.push(`decorations ${formatSigned(v.deco)}`)
  parts.push(`total ${formatPoints(v.total)}`)
  parts.push(v.totalTier ? `active tier ${v.totalTier.name}` : 'no active tier')
  if (v.hint.text) parts.push(v.hint.text.replace(' · ', ', '))
  return parts.join(', ')
}

export interface SummaryChip {
  key: string
  kind: 'active' | 'near' | 'penalty'
  text: string
}

/**
 * Chips for the mobile summary: an active positive tier ("<tier> · <total>"), a skill one point short of its next
 * tier ("<skill> · <total>/<next threshold>"), an active penalty tier (its name). A skill can yield two chips
 * (an active tier that is also one point from the next). Skills with none of these get no chip.
 */
export function summaryChips(views: readonly SkillView[]): SummaryChip[] {
  const chips: SummaryChip[] = []
  for (const v of views) {
    if (v.totalTier && v.totalTier.points > 0) {
      chips.push({ key: `a${v.treeId}`, kind: 'active', text: `${v.totalTier.name} · ${formatPoints(v.total)}` })
    } else if (v.totalTier && v.totalTier.points < 0) {
      chips.push({ key: `p${v.treeId}`, kind: 'penalty', text: v.totalTier.name })
    }
    if (v.hint.near) {
      const next = v.tiers.find((t) => t.points > v.total)
      if (next) chips.push({ key: `n${v.treeId}`, kind: 'near', text: `${v.name} · ${formatPoints(v.total)}/${next.points}` })
    }
  }
  return chips
}
