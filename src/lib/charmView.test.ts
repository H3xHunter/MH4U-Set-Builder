import { describe, expect, it } from 'vitest'
import type { SavedCharm, SkillTree } from '@/data/types'
import {
  charmLabel,
  charmSummary,
  charmTier,
  draftInput,
  draftOf,
  draftProblem,
  editConflict,
  emptyDraft,
  isDirty,
  findSkills,
  stepPoints,
  type CharmDraft,
} from './charmView'
import { CHARM_POINTS_LIMIT, MAX_CHARMS } from './charms'

const names: Record<string, string> = { '1': 'Attack Up', '2': 'Sharpness', '3': 'Defense' }
const nameOf = (id: number | string) => names[String(id)] ?? `#${id}`
const charm = (over: Partial<SavedCharm> = {}): SavedCharm => ({ id: 'a', name: '', slots: 2, skills: { '2': 5, '1': 8 }, ...over })

describe('charm labels', () => {
  it('summary lists skills with signed points, strongest first, then the slot count', () => {
    expect(charmSummary(charm(), nameOf)).toBe('Attack Up +8, Sharpness +5 · 2 slots')
    expect(charmSummary(charm({ skills: { '3': -10, '1': 4 }, slots: 1 }), nameOf)).toBe('Attack Up +4, Defense -10 · 1 slot')
    expect(charmSummary(charm({ skills: {}, slots: 3 }), nameOf)).toBe('Slots only · 3 slots')
    expect(charmSummary(charm({ slots: 0 }), nameOf)).toBe('Attack Up +8, Sharpness +5 · no slots')
  })
  it('shows an id for a skill missing from the data, and prefers the custom name', () => {
    expect(charmSummary(charm({ skills: { '99': 1 } }), nameOf)).toBe('#99 +1 · 2 slots')
    expect(charmLabel(charm({ name: 'My charm' }), nameOf)).toBe('My charm')
    expect(charmLabel(charm(), nameOf)).toBe('Attack Up +8, Sharpness +5 · 2 slots')
  })
})

describe('stepPoints', () => {
  it('skips 0 in both directions', () => {
    expect(stepPoints(1, -1)).toBe(-1)
    expect(stepPoints(-1, 1)).toBe(1)
    expect(stepPoints(5, 1)).toBe(6)
    expect(stepPoints(-5, -1)).toBe(-6)
  })
  it('stops at the limits', () => {
    expect(stepPoints(CHARM_POINTS_LIMIT, 1)).toBe(CHARM_POINTS_LIMIT)
    expect(stepPoints(-CHARM_POINTS_LIMIT, -1)).toBe(-CHARM_POINTS_LIMIT)
  })
})

describe('draft', () => {
  const d = (over: Partial<CharmDraft> = {}): CharmDraft => ({ name: '', slots: 1, rows: [{ skillId: 1, points: 3 }], ...over })
  it('round trips through a charm; input is trimmed', () => {
    expect(draftOf(charm({ name: 'n' }))).toEqual({ name: 'n', slots: 2, rows: [{ skillId: 1, points: 8 }, { skillId: 2, points: 5 }] })
    expect(draftInput(d({ name: '  x ', rows: [{ skillId: 1, points: -2 }, { skillId: 2, points: 4 }] }))).toEqual({
      name: 'x',
      slots: 1,
      skills: { '1': -2, '2': 4 },
    })
  })
  it('a charm with more than two skills is shown whole', () => {
    expect(draftOf(charm({ skills: { '1': 1, '2': 2, '3': 3 } })).rows).toHaveLength(3)
  })
  it('problems', () => {
    expect(draftProblem(d(), 0, true)).toBeNull()
    expect(draftProblem(emptyDraft(), 0, true)).toMatch(/at least 1 slot/)
    expect(draftProblem(d({ rows: [], slots: 2 }), 0, true)).toBeNull() // slots only
    expect(draftProblem(d({ rows: [{ skillId: 1, points: 2 }, { skillId: 1, points: 3 }] }), 0, true)).toMatch(/only appear once/)
    expect(draftProblem(d({ rows: [{ skillId: null, points: 1 }] }), 0, true)).toMatch(/Choose a skill/)
    expect(draftProblem(d({ rows: [{ skillId: 1, points: 0 }] }), 0, true)).toMatch(/not 0/)
    expect(draftProblem(d({ rows: [{ skillId: 1, points: 21 }] }), 0, true)).toMatch(/between/)
    expect(draftProblem(d({ name: 'x'.repeat(41) }), 0, true)).toMatch(/longer than 40/)
    expect(draftProblem(d(), MAX_CHARMS, true)).toMatch(/full/)
    expect(draftProblem(d(), MAX_CHARMS, false)).toBeNull() // editing a charm in a full list is fine
  })
})

describe('charmTier and findSkills', () => {
  const tree: SkillTree = {
    id: 1,
    name: 'Attack Up',
    tiers: [-10, 10, 15].map((points) => ({ points, name: `T${points}`, description: null })),
  }
  it('uses the skill own thresholds', () => {
    expect(charmTier(tree, 4)).toBeNull()
    expect(charmTier(tree, 12)).toEqual({ points: 10, name: 'T10' })
    expect(charmTier(tree, -12)).toEqual({ points: -10, name: 'T-10' })
    expect(charmTier(undefined, 5)).toBeNull()
  })
  it('searches by name, sorted, minus excluded ids', () => {
    const trees = ['Zeta', 'Attack Up', 'Attack Down'].map((name, i): SkillTree => ({ id: i + 1, name, tiers: [] }))
    expect(findSkills(trees, 'att').map((t) => t.name)).toEqual(['Attack Down', 'Attack Up'])
    expect(findSkills(trees, '', [2]).map((t) => t.name)).toEqual(['Attack Down', 'Zeta'])
    expect(findSkills(trees, 'nope')).toEqual([])
  })
})

describe('isDirty and editConflict', () => {
  const start = (): CharmDraft => ({ name: 'A', slots: 1, rows: [{ skillId: 1, points: 3 }] })
  it('untouched is not dirty; edited then reverted is not dirty', () => {
    expect(isDirty(start(), start())).toBe(false)
    const edited = { ...start(), name: 'AB', rows: [{ skillId: 1, points: 4 }] }
    expect(isDirty(edited, start())).toBe(true)
    expect(isDirty({ ...edited, name: 'A', rows: [{ skillId: 1, points: 3 }] }, start())).toBe(false)
  })
  it('each field counts', () => {
    expect(isDirty({ ...start(), slots: 2 }, start())).toBe(true)
    expect(isDirty({ ...start(), rows: [{ skillId: 2, points: 3 }] }, start())).toBe(true)
    expect(isDirty({ ...start(), rows: [...start().rows, { skillId: null, points: 1 }] }, start())).toBe(true)
    expect(isDirty({ ...start(), rows: [] }, start())).toBe(true)
  })
  it('a new charm with any input is dirty, an empty one is not', () => {
    expect(isDirty(emptyDraft(), emptyDraft())).toBe(false)
    expect(isDirty({ ...emptyDraft(), name: 'x' }, emptyDraft())).toBe(true)
    expect(isDirty({ ...emptyDraft(), slots: 1 }, emptyDraft())).toBe(true)
    expect(isDirty({ ...emptyDraft(), rows: [{ skillId: null, points: 1 }] }, emptyDraft())).toBe(true)
  })
  it('editConflict: same, changed, deleted, and new', () => {
    const base = charm({ id: 'a' })
    expect(editConflict(base, { ...base })).toBeNull()
    expect(editConflict(base, { ...base, skills: { '1': 9 } })).toBe('changed')
    expect(editConflict(base, { ...base, slots: 3 })).toBe('changed')
    expect(editConflict(base, { ...base, name: 'new' })).toBe('changed')
    expect(editConflict(base, undefined)).toBe('deleted')
    expect(editConflict(null, undefined)).toBeNull()
  })
})
