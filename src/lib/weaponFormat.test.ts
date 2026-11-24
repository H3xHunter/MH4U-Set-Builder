import { describe, expect, it } from 'vitest'
import { loadRealData } from '@/data/real-data-fixture'
import { mkWeapon } from '@/state/fixtures'
import { elementColor, elementParts, formatAffinity, isDoubleAffinity } from './weaponFormat'

describe('weaponFormat', () => {
  it('formats single affinity with the real minus sign', () => {
    expect(formatAffinity(mkWeapon(1, 0, { affinity: 30 }))).toBe('+30%')
    expect(formatAffinity(mkWeapon(1, 0, { affinity: -10 }))).toBe('−10%')
    expect(formatAffinity(mkWeapon(1, 0, { affinity: 0 }))).toBe('0%')
  })

  it('formats double affinity ascending, whatever the source order', () => {
    const w = mkWeapon(1, 0, { affinity: null, affinityOptions: [20, -45] })
    expect(formatAffinity(w)).toBe('−45% / +20%')
    expect(isDoubleAffinity(w)).toBe(true)
  })

  it('element parts: none, element + element2, awaken', () => {
    expect(elementParts(mkWeapon(1, 0))).toEqual([])
    const w = mkWeapon(1, 0, {
      element: { type: 'Water', value: 40 },
      element2: { type: 'Ice', value: 80 },
      awaken: { type: 'Fire', value: 430 },
    })
    expect(elementParts(w).map((p) => [p.kind, p.label])).toEqual([
      ['element', 'Water 40'],
      ['element2', 'Ice 80'],
      ['awaken', 'Awaken Fire 430'],
    ])
  })

  it('real data: 16 double-affinity weapons, all ascending; every weapon formats', () => {
    const { weapons } = loadRealData()
    const doubles = weapons.filter(isDoubleAffinity)
    expect(doubles).toHaveLength(16)
    for (const w of doubles) {
      const [a, b] = w.affinityOptions!
      expect(formatAffinity(w)).toContain(' / ')
      expect(Math.min(a, b)).toBeLessThanOrEqual(Math.max(a, b))
    }
    expect(doubles.find((w) => w.id === 5168)).toBeDefined()
    expect(formatAffinity(doubles.find((w) => w.id === 5168)!)).toBe('−45% / +20%')
    for (const w of weapons) expect(formatAffinity(w)).not.toBe('—')
    expect(weapons.filter((w) => elementParts(w).length === 0)).toHaveLength(633)
    expect(weapons.filter((w) => w.awaken)).toHaveLength(375)
  })

  it('element dot colors: the five elements have tokens, statuses do not', () => {
    expect(elementColor('Fire')).toBe('var(--element-fire)')
    expect(elementColor('Thunder')).toBe('var(--element-thunder)')
    for (const status of ['Poison', 'Blastblight', 'Paralysis', 'Sleep']) expect(elementColor(status)).toBeUndefined()
    const { weapons } = loadRealData()
    const types = new Set(weapons.flatMap((w) => elementParts(w).map((p) => p.type)))
    expect([...types].filter((t) => elementColor(t)).sort()).toEqual(['Dragon', 'Fire', 'Ice', 'Thunder', 'Water'])
  })
})
