import { describe, expect, it } from 'vitest'
import type { SavedCharm } from '@/data/types'
import { mkData } from '@/state/fixtures'
import {
  addCharm,
  duplicateCharm,
  MAX_CHARMS,
  CHARMS_BACKUP_KEY,
  CHARMS_BACKUP2_KEY,
  summarizeIssues,
  CHARMS_KEY,
  createCharm,
  deleteCharm,
  loadCharms,
  saveCharms,
  updateCharm,
  validateCharmInput,
  type StorageLike,
} from './charms'

const base = mkData()
const data = {
  ...base,
  meta: { ...base.meta, dataVersion: 3, torsoUpTreeId: 9 },
  skills: [1, 2, 9].map((id) => ({ id, name: `s${id}`, tiers: [] })),
}

const memory = (initial: Record<string, string> = {}) => {
  const m = new Map(Object.entries(initial))
  const s: StorageLike & { m: Map<string, string> } = {
    m,
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
  }
  return s
}
const wrap = (charms: unknown, over: Record<string, unknown> = {}) =>
  JSON.stringify({ version: 1, dataVersion: 3, charms, ...over })
const good = (id: string, over: Partial<SavedCharm> = {}): SavedCharm => ({ id, name: id, slots: 1, skills: { '1': 2 }, ...over })

describe('loadCharms', () => {
  it('missing key: empty, no issues, no backup', () => {
    const st = memory()
    expect(loadCharms(data, st)).toEqual({ charms: [], issues: [] })
    expect(st.m.size).toBe(0)
  })

  it('valid data loads untouched', () => {
    const list = [good('a'), good('b', { slots: 0 })]
    const st = memory({ [CHARMS_KEY]: wrap(list) })
    expect(loadCharms(data, st)).toEqual({ charms: list, issues: [] })
    expect(st.m.has(CHARMS_BACKUP_KEY)).toBe(false)
  })

  it.each([
    ['corrupted JSON', '{nope'],
    ['unknown version', wrap([good('a')], { version: 2 })],
    ['mismatched dataVersion', wrap([good('a')], { dataVersion: 4 })],
    ['not an object', '[]'],
    ['charms not an array', wrap({})],
    ['oversized raw value', 'x'.repeat(200 * 1024 + 1)],
  ])('%s: empty list, an issue, and the raw string backed up', (_n, raw) => {
    const st = memory({ [CHARMS_KEY]: raw })
    const r = loadCharms(data, st)
    expect(r.charms).toEqual([])
    expect(r.issues.length).toBeGreaterThanOrEqual(2)
    expect(st.m.get(CHARMS_BACKUP_KEY)).toBe(raw)
    expect(st.m.get(CHARMS_KEY)).toBe(raw)
  })

  it('keeps valid entries, drops invalid ones with issues, writes the backup', () => {
    const raw = wrap([good('a'), { id: 'b', name: 'x'.repeat(41), slots: 1, skills: { '1': 21 } }, 'junk', good('c')])
    const st = memory({ [CHARMS_KEY]: raw })
    const r = loadCharms(data, st)
    expect(r.charms.map((c) => c.id)).toEqual(['a', 'c'])
    expect(r.issues.filter((i) => i.index !== undefined).map((i) => i.index)).toEqual([1, 2])
    expect(r.issues.some((i) => i.reason.includes('backup'))).toBe(true)
    expect(st.m.get(CHARMS_BACKUP_KEY)).toBe(raw)
  })

  it('drops unknown tree ids and the Torso Up tree', () => {
    const r = loadCharms(data, memory({ [CHARMS_KEY]: wrap([good('a', { skills: { '77': 1 } }), good('b', { skills: { '9': 1 } }), good('c')]) }))
    expect(r.charms.map((c) => c.id)).toEqual(['c'])
  })

  it('duplicate ids: first wins', () => {
    const r = loadCharms(data, memory({ [CHARMS_KEY]: wrap([good('a', { name: 'first' }), good('a', { name: 'second' })]) }))
    expect(r.charms).toHaveLength(1)
    expect(r.charms[0].name).toBe('first')
    expect(r.issues[0]).toMatchObject({ index: 1 })
  })

  it('keeps at most 100 charms', () => {
    const list = Array.from({ length: 101 }, (_, i) => good(`c${i}`))
    const st = memory({ [CHARMS_KEY]: wrap(list) })
    const r = loadCharms(data, st)
    expect(r.charms).toHaveLength(100)
    expect(r.charms[99].id).toBe('c99')
    expect(r.issues[0]).toMatchObject({ index: 100 })
    expect(st.m.has(CHARMS_BACKUP_KEY)).toBe(true)
  })

  it('never throws when getItem throws', () => {
    const st: StorageLike = { getItem: () => { throw new Error('denied') }, setItem: () => {} }
    expect(loadCharms(data, st)).toMatchObject({ charms: [], issues: [{ reason: expect.stringContaining('denied') }] })
  })

  it('reports a failing backup write instead of throwing', () => {
    const st: StorageLike = { getItem: (k) => (k === CHARMS_KEY ? '{nope' : null), setItem: () => { throw new Error('quota') } }
    const r = loadCharms(data, st)
    expect(r.charms).toEqual([])
    expect(r.issues.some((i) => i.reason.includes('quota'))).toBe(true)
  })

  it('never throws when accessing globalThis.localStorage throws', () => {
    const saved = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('blocked') } })
    try {
      expect(loadCharms(data)).toMatchObject({ charms: [], issues: [{ reason: expect.stringContaining('unavailable') }] })
      expect(saveCharms(data, [])).toMatchObject({ ok: false })
    } finally {
      if (saved) Object.defineProperty(globalThis, 'localStorage', saved)
      else delete (globalThis as { localStorage?: unknown }).localStorage
    }
  })
})

describe('saveCharms', () => {
  it('writes the documented format', () => {
    const st = memory()
    expect(saveCharms(data, [good('a')], st)).toEqual({ ok: true })
    expect(JSON.parse(st.m.get(CHARMS_KEY)!)).toEqual({ version: 1, dataVersion: 3, charms: [good('a')] })
  })
  it('returns ok:false when setItem throws (quota)', () => {
    const st: StorageLike = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError') } }
    expect(saveCharms(data, [good('a')], st)).toEqual({ ok: false, reason: 'QuotaExceededError' })
  })
})

describe('validateCharmInput', () => {
  const ok = { id: 'a', name: 'x', slots: 1, skills: {} }
  it('trims names, allows no name, and caps the length at 40', () => {
    expect(validateCharmInput(data, { ...ok, name: '  Hi  ' })).toMatchObject({ ok: true, charm: { name: 'Hi' } })
    expect(validateCharmInput(data, { ...ok, name: 'x'.repeat(40) }).ok).toBe(true)
    expect(validateCharmInput(data, { ...ok, name: 'x'.repeat(41) }).ok).toBe(false)
    expect(validateCharmInput(data, { ...ok, name: '   ' })).toMatchObject({ ok: true, charm: { name: '' } })
    expect(validateCharmInput(data, { ...ok, name: '' }).ok).toBe(true)
    expect(validateCharmInput(data, { ...ok, name: 5 }).ok).toBe(false)
  })
  it('a slot-only charm is valid; neither slots nor skills is not', () => {
    expect(validateCharmInput(data, { ...ok, slots: 2, skills: {} }).ok).toBe(true)
    expect(validateCharmInput(data, { ...ok, slots: 0, skills: { '1': 1 } }).ok).toBe(true)
    expect(validateCharmInput(data, { ...ok, slots: 0, skills: {} }).ok).toBe(false)
  })
  it.each([
    ['slots 4', { slots: 4 }],
    ['non-integer slots', { slots: 1.5 }],
    ['zero points', { skills: { '1': 0 } }],
    ['fractional points', { skills: { '1': 1.5 } }],
    ['points over 20', { skills: { '1': 21 } }],
    ['points under -20', { skills: { '1': -21 } }],
    ['string points', { skills: { '1': '2' } }],
    ['more than 8 skills', { skills: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [String(i + 1), 1])) }],
    ['Torso Up tree', { skills: { '9': 1 } }],
    ['bad id chars', { id: 'a b' }],
    ['id too long', { id: 'a'.repeat(65) }],
    ['skills as array', { skills: [] }],
  ])('rejects %s', (_n, over) => {
    expect(validateCharmInput(data, { ...ok, skills: { '1': 1 }, ...over }).ok).toBe(false)
  })
  it('allows negative points and treats names as opaque text', () => {
    const r = validateCharmInput(data, { ...ok, name: '<img onerror=x>', skills: { '1': -3 } })
    expect(r).toMatchObject({ ok: true, charm: { name: '<img onerror=x>', skills: { '1': -3 } } })
  })
})

describe('helpers and round trip', () => {
  it('create, save, load, update, delete without mutation', () => {
    const st = memory()
    const made = createCharm(data, { name: ' Attack 2 ', slots: 1, skills: { '1': 4 } }, () => 'id-1')
    if (!made.ok) throw new Error('expected ok')
    const list = [made.charm]
    saveCharms(data, list, st)
    const loaded = loadCharms(data, st)
    expect(loaded).toEqual({ charms: [{ id: 'id-1', name: 'Attack 2', slots: 1, skills: { '1': 4 } }], issues: [] })

    const upd = updateCharm(data, loaded.charms, 'id-1', { slots: 3, name: 'Renamed' })
    if (!upd.ok) throw new Error('expected ok')
    expect(upd.charms[0]).toMatchObject({ id: 'id-1', name: 'Renamed', slots: 3, skills: { '1': 4 } })
    expect(loaded.charms[0].slots).toBe(1)
    expect(updateCharm(data, loaded.charms, 'id-1', { slots: 9 }).ok).toBe(false)
    expect(updateCharm(data, loaded.charms, 'nope', {}).ok).toBe(false)

    const after = deleteCharm(upd.charms, 'id-1')
    expect(after).toEqual([])
    expect(upd.charms).toHaveLength(1)
  })
  it('createCharm returns errors and generates a valid default id', () => {
    expect(createCharm(data, { name: '', slots: 0, skills: {} }, () => 'x').ok).toBe(false)
    expect(createCharm(data, { name: 'n', slots: 1, skills: {} }).ok).toBe(true)
  })
})

describe('limits and list operations', () => {
  it('accepts points at the limit (-20 and +20) and rejects duplicate tree keys via the object shape', () => {
    expect(validateCharmInput(data, { id: 'a', name: '', slots: 0, skills: { '1': 20, '2': -20 } }).ok).toBe(true)
  })
  it('wrong dataVersion and malformed JSON are rejected with a backup (see loadCharms cases above)', () => {
    const st = memory({ [CHARMS_KEY]: wrap([good('a')], { dataVersion: 2 }) })
    expect(loadCharms(data, st).charms).toEqual([])
    expect(st.m.has(CHARMS_BACKUP_KEY)).toBe(true)
  })
  it('addCharm appends, validates and refuses past the cap', () => {
    const r = addCharm(data, [good('a')], { name: 'n', slots: 1, skills: {} }, () => 'b')
    expect(r.ok && r.charms.map((c) => c.id)).toEqual(['a', 'b'])
    expect(addCharm(data, [good('a')], { name: '', slots: 0, skills: {} }).ok).toBe(false)
    const full = Array.from({ length: MAX_CHARMS }, (_, i) => good(`c${i}`))
    expect(addCharm(data, full, { name: 'n', slots: 1, skills: {} })).toMatchObject({ ok: false, errors: [expect.stringContaining('full')] })
  })
  it('duplicateCharm copies after the original with a new id, " (copy)" and the cap', () => {
    const list = [good('a', { name: 'Atk' }), good('b', { name: '' })]
    const r = duplicateCharm(data, list, 'a', () => 'a2')
    expect(r.ok && r.charms.map((c) => [c.id, c.name])).toEqual([['a', 'Atk'], ['a2', 'Atk (copy)'], ['b', '']])
    const long = duplicateCharm(data, [good('a', { name: 'x'.repeat(40) })], 'a', () => 'a2')
    expect(long.ok && long.charms[1].name).toHaveLength(40)
    const unnamed = duplicateCharm(data, list, 'b', () => 'b2')
    expect(unnamed.ok && unnamed.charms[2].name).toBe('')
    expect(duplicateCharm(data, list, 'zz').ok).toBe(false)
    const full = Array.from({ length: MAX_CHARMS }, (_, i) => good(`c${i}`))
    expect(duplicateCharm(data, full, 'c0').ok).toBe(false)
  })
})

describe('backups are never clobbered', () => {
  it('a second, different bad value goes to the second key; the first backup stays', () => {
    const st = memory({ [CHARMS_KEY]: '{first' })
    loadCharms(data, st)
    // the user then saves a good list, and later the value is corrupted again
    saveCharms(data, [good('a')], st)
    st.m.set(CHARMS_KEY, '{second')
    loadCharms(data, st)
    expect(st.m.get(CHARMS_BACKUP_KEY)).toBe('{first')
    expect(st.m.get(CHARMS_BACKUP2_KEY)).toBe('{second')
  })
  it('the same bad value loaded again is not written twice, and saving a new charm does not touch the backup', () => {
    const st = memory({ [CHARMS_KEY]: wrap([good('a')], { dataVersion: 9 }) })
    const raw = st.m.get(CHARMS_KEY)!
    loadCharms(data, st)
    loadCharms(data, st)
    saveCharms(data, [good('new')], st)
    expect(st.m.get(CHARMS_BACKUP_KEY)).toBe(raw)
    expect(st.m.has(CHARMS_BACKUP2_KEY)).toBe(false)
  })
})

describe('summarizeIssues: every whole-list failure is visible', () => {
  const blocked = () => {
    const saved = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('blocked') } })
    try {
      return loadCharms(data)
    } finally {
      if (saved) Object.defineProperty(globalThis, 'localStorage', saved)
      else delete (globalThis as { localStorage?: unknown }).localStorage
    }
  }
  it.each([
    ['broken JSON', '{nope'],
    ['wrong dataVersion', wrap([good('a')], { dataVersion: 4 })],
    ['unknown storage version', wrap([good('a')], { version: 2 })],
    ['charms not an array', wrap({})],
  ])('%s counts as unreadable', (_n, raw) => {
    expect(summarizeIssues(loadCharms(data, memory({ [CHARMS_KEY]: raw })).issues)).toEqual({ unreadable: 1, storageUnavailable: false })
  })
  it('dropped entries are counted one by one', () => {
    const raw = wrap([good('a'), 'junk', { id: 'b' }])
    expect(summarizeIssues(loadCharms(data, memory({ [CHARMS_KEY]: raw })).issues).unreadable).toBe(2)
  })
  it('storage blocked or unreadable is reported as unavailable, not as unreadable charms', () => {
    expect(summarizeIssues(blocked().issues)).toEqual({ unreadable: 0, storageUnavailable: true })
    const st: StorageLike = { getItem: () => { throw new Error('denied') }, setItem: () => {} }
    expect(summarizeIssues(loadCharms(data, st).issues)).toEqual({ unreadable: 0, storageUnavailable: true })
  })
  it('a clean load says nothing', () => {
    expect(summarizeIssues(loadCharms(data, memory()).issues)).toEqual({ unreadable: 0, storageUnavailable: false })
  })
})
