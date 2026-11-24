import { describe, expect, it } from 'vitest'
import { loadRealData } from '@/data/real-data-fixture'
import { computeSkills, type SkillRow } from './skills'
import {
  buildSkillView,
  formatPoints,
  skillAriaLabel,
  skillHint,
  skillRows,
  summarizeSkills,
  summaryChips,
  type TierInfo,
} from './skillBar'
import type { SkillTree } from '@/data/types'

const tiers = (...points: number[]): TierInfo[] => points.map((p) => ({ points: p, name: `T${p}` }))
const view = (t: number[], shownBase: number, deco: number, torsoUp = 0) =>
  buildSkillView({ treeId: 1, name: 'Skill', tiers: tiers(...t), shownBase, torsoUp, deco })
const seg = (v: ReturnType<typeof view>, kind: string) => v.bar.segments.find((s) => s.kind === kind)
const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 6)

describe('skill bar: design variants', () => {
  it('one tier (Handicraft)', () => {
    const v = view([10], 7, 2)
    close(seg(v, 'base')!.fromPct, 0)
    close(seg(v, 'base')!.toPct, 70)
    close(seg(v, 'deco')!.fromPct, 70)
    close(seg(v, 'deco')!.toPct, 90)
    close(v.bar.ticks[0].pct, 100)
    expect(v.bar.ticks[0].state).toBe('none')
    expect(v.hint).toEqual({ kind: 'next', text: 'Next: T10 at 10 · 1 more point', near: true })
  })

  it('two tiers (Guard): first tick reached by decorations', () => {
    const v = view([10, 15], 8, 4)
    expect(v.bar.ticks.map((t) => t.state)).toEqual(['deco', 'none'])
    expect(v.hint.text).toBe('Next: T15 at 15 · 3 more points')
    expect(v.hint.near).toBe(false)
  })

  it('four tiers + Torso Up (Attack): torso segment sits between base and deco', () => {
    const v = view([10, 15, 20, 25], 9, 5, 4)
    expect(v.base).toBe(13)
    expect(v.total).toBe(18)
    expect(v.bar.segments.map((s) => s.kind)).toEqual(['base', 'torso', 'deco'])
    close(seg(v, 'base')!.toPct, 36)
    close(seg(v, 'torso')!.fromPct, 36)
    close(seg(v, 'torso')!.toPct, 52)
    close(seg(v, 'deco')!.fromPct, 52)
    close(seg(v, 'deco')!.toPct, 72)
    expect(v.baseTier?.points).toBe(10)
    expect(v.totalTier?.points).toBe(15)
    expect(v.hint.text).toBe('Next: T20 at 20 · 2 more points')
    expect(v.bar.ticks.map((t) => t.state)).toEqual(['base', 'deco', 'none', 'none'])
  })

  it('positive and negative (Fire Res): zero is proportional on the scale', () => {
    const v = view([-20, -15, -10, 10, 15], 6, 4)
    close(v.bar.zeroPct, (20 / 35) * 100)
    expect(v.hint.text).toBe('Next: T15 at 15 · 5 more points')
    expect(v.bar.ticks.map((t) => t.state)).toEqual(['none', 'none', 'none', 'deco', 'none'])
  })

  it('past the top: bar full, overMax counts the excess', () => {
    const v = view([10], 12, 5)
    expect(v.total).toBe(17)
    expect(v.bar.overMax).toBe(7)
    expect(v.bar.topReached).toBe(true)
    close(v.bar.segments[v.bar.segments.length - 1].toPct, 100)
    expect(v.hint).toEqual({ kind: 'top', text: 'Top tier reached', near: false })
  })

  it('past the top with a base past it too', () => {
    const v = view([10, 15, 20, 25], 22, 6)
    expect(v.total).toBe(28)
    expect(v.bar.overMax).toBe(3)
    expect(v.bar.segments.map((s) => s.kind)).toEqual(['base', 'deco'])
    close(v.bar.segments[1].toPct, 100)
  })

  it('negative total (Hunger): solid penalty 0..-12, hatch -14..-12, tick -10 active', () => {
    const v = view([-20, -15, -10, 10, 15], -14, 2)
    const pct = (x: number) => ((x + 20) / 35) * 100
    close(seg(v, 'penalty')!.fromPct, pct(-12))
    close(seg(v, 'penalty')!.toPct, pct(0))
    close(seg(v, 'deco')!.fromPct, pct(-14))
    close(seg(v, 'deco')!.toPct, pct(-12))
    expect(v.bar.ticks.map((t) => t.state)).toEqual(['none', 'none', 'active', 'none', 'none'])
    expect(v.hint).toEqual({ kind: 'clear', text: '3 more points clear T-10', near: false })
    expect(v.bar.rail).toBeUndefined()
  })

  it('negative base, positive total (Expert): rail, deco across zero, tick -10 cleared', () => {
    const v = view([-20, -15, -10, 10, 15, 20], -11, 13)
    expect(v.total).toBe(2)
    const pct = (x: number) => ((x + 20) / 40) * 100
    close(v.bar.rail!.fromPct, pct(-11))
    close(v.bar.rail!.toPct, pct(0))
    close(seg(v, 'deco')!.fromPct, pct(-11))
    close(seg(v, 'deco')!.toPct, pct(2))
    expect(v.bar.segments.some((s) => s.kind === 'penalty')).toBe(false)
    expect(v.bar.ticks[2].state).toBe('cleared')
    expect(v.hint.text).toBe('Next: T10 at 10 · 8 more points')
  })

  it('negative only (Fatigue): the bar ends just past zero', () => {
    const v = view([-15, -10], -8, 0)
    expect(v.bar.max).toBeCloseTo(0.9)
    expect(v.bar.zeroPct).toBeGreaterThan(90)
    expect(v.bar.zeroPct).toBeLessThan(100)
    expect(v.hint).toEqual({ kind: 'from', text: '2 points from T-10', near: false })
  })
})

describe('skill bar: extra cases and my choices', () => {
  it('a negative decoration delta on a positive base is drawn as decoNegative, solid stops at the total', () => {
    const v = view([10, 20], 12, -4)
    expect(v.bar.segments.map((s) => s.kind)).toEqual(['base', 'decoNegative'])
    close(seg(v, 'base')!.toPct, 40)
    close(seg(v, 'decoNegative')!.fromPct, 40)
    close(seg(v, 'decoNegative')!.toPct, 60)
  })

  it('underMin counts penalty beyond the deepest negative tier', () => {
    expect(view([-15, -10, 10], -18, 0).bar.underMin).toBe(3)
    expect(view([-15, -10, 10], -12, 0).bar.underMin).toBe(0)
  })

  it('label rule: the 0 label and the last tick are always shown, crowded ticks are hidden', () => {
    const v = view([-20, -15, -10, 10, 15], 0, 5)
    // gaps are 14.3% apart, so every tick fits
    expect(v.bar.ticks.every((t) => t.labelVisible)).toBe(true)
    const crowded = view([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 100], 0, 1)
    expect(crowded.bar.ticks[crowded.bar.ticks.length - 1].labelVisible).toBe(true)
    expect(crowded.bar.ticks.filter((t) => t.labelVisible).length).toBeLessThan(crowded.bar.ticks.length)
    const neg = view([-15, -10], -8, 0)
    expect(neg.bar.zeroLabel).toBe(true)
    expect(neg.bar.ticks[1].labelVisible).toBe(true)
  })

  it('hint wording: singular and plural, near only for the positive Next form', () => {
    expect(skillHint({ tiers: tiers(10, 15), total: 14 }).text).toBe('Next: T15 at 15 · 1 more point')
    expect(skillHint({ tiers: tiers(10, 15), total: 14 }).near).toBe(true)
    expect(skillHint({ tiers: tiers(10, 15), total: 0 }).near).toBe(false)
    expect(skillHint({ tiers: tiers(-10, 10), total: -10 }).text).toBe('1 more point clear T-10')
    expect(skillHint({ tiers: tiers(-10), total: -9 }).text).toBe('1 point from T-10')
    expect(skillHint({ tiers: [], total: 3 })).toEqual({ kind: 'none', text: '', near: false })
  })

  it('formats points with the real minus sign and the aria label states everything in words', () => {
    expect(formatPoints(-3)).toBe('−3')
    const label = skillAriaLabel(view([10, 15, 20, 25], 9, 5, 4))
    expect(label).toContain('base 9')
    expect(label).toContain('Torso Up +4')
    expect(label).toContain('decorations +5')
    expect(label).toContain('total 18')
    expect(label).toContain('active tier T15')
    expect(label).toContain('Next: T20 at 20')
  })
})

describe('skillRows and summarizeSkills', () => {
  const trees: SkillTree[] = [
    { id: 1, name: 'Beta', tiers: [{ points: 10, name: 'B1', description: null }] },
    { id: 2, name: 'Alpha', tiers: [{ points: 10, name: 'A1', description: null }] },
    { id: 3, name: 'Gamma', tiers: [{ points: -10, name: 'G-', description: null }, { points: 10, name: 'G+', description: null }] },
  ]
  const row = (treeId: number, p: Partial<SkillRow>): SkillRow => ({
    treeId, armor: 0, charm: 0, torsoUpBase: 0, deco: 0, torsoUpDeco: 0, base: 0, total: 0, baseTier: null, totalTier: null, ...p,
  })

  it('sorts by total descending (negatives last), ties by name, and hides all-zero rows', () => {
    const rows = skillRows(
      [row(1, { base: 10, total: 10 }), row(2, { base: 10, total: 10 }), row(3, { base: -12, total: -12 }), row(99, { armor: 2, deco: -2 })],
      trees,
    )
    expect(rows.map((r) => r.name)).toEqual(['Alpha', 'Beta', 'Gamma'])
  })

  it('shown base excludes Torso Up, the delta includes Torso Up decorations', () => {
    const [v] = skillRows([row(1, { armor: 5, charm: 1, torsoUpBase: 3, deco: 2, torsoUpDeco: 1, base: 9, total: 12 })], trees)
    expect([v.shownBase, v.torsoUp, v.deco, v.base, v.total]).toEqual([6, 3, 3, 9, 12])
  })

  it('counts active (non-null total tier) and near (one point from the next tier)', () => {
    const rows = skillRows(
      [row(1, { base: 9, total: 9 }), row(2, { base: 10, total: 10 }), row(3, { base: -12, total: -12 })],
      trees,
    )
    // Beta: 9 -> no tier, near (1 point); Alpha: 10 -> top; Gamma: -12 -> negative tier active
    expect(summarizeSkills(rows)).toEqual({ active: 2, near: 1 })
  })

  it('real data: the view tiers match the tiers computeSkills reports', () => {
    const data = loadRealData()
    const piece = data.armor.find((a) => a.slot === 'head' && Object.values(a.skills).some((v) => v >= 10))!
    const computed = computeSkills({ pieces: { head: { armor: piece, decorations: [] } }, charm: null, weaponDecorations: [] }, data.skills)
    for (const r of computed) {
      const v = skillRows([r], data.skills)[0]
      expect(v.baseTier).toEqual(r.baseTier)
      expect(v.totalTier).toEqual(r.totalTier)
    }
  })
})

describe('summaryChips', () => {
  const v = (name: string, t: number[], shownBase: number, deco = 0) =>
    buildSkillView({ treeId: name.charCodeAt(0), name, tiers: tiers(...t), shownBase, torsoUp: 0, deco })

  it('active positive, near, and penalty chips; nothing for the rest', () => {
    const chips = summaryChips([
      v('Alpha', [10, 15], 12), // active T10, 3 away: tier chip only
      v('Beta', [10], 9), // no tier, near: near chip only
      v('Gamma', [-10, 10], -12), // active penalty
      v('Delta', [10], 3), // nothing
      v('Epsilon', [10, 15], 14), // active T10 and one point from T15: both chips
    ])
    expect(chips.map((c) => [c.kind, c.text])).toEqual([
      ['active', 'T10 · 12'],
      ['near', 'Beta · 9/10'],
      ['penalty', 'T-10'],
      ['active', 'T10 · 14'],
      ['near', 'Epsilon · 14/15'],
    ])
  })
})
