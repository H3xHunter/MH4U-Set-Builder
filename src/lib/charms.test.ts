import { describe, expect, it } from 'vitest'
import type { SavedCharm } from '@/data/types'
import { mkData } from '@/state/fixtures'
import {
  CHARMS_BACKUP_KEY,
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
    const raw = wrap([good('a'), { id: 'b', name: '', slots: 1, skills: {} }, 'junk', good('c')])
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

  it('keeps at most 200 charms', () => {
    const list = Array.from({ length: 201 }, (_, i) => good(`c${i}`))
    const st = memory({ [CHARMS_KEY]: wrap(list) })
    const r = loadCharms(data, st)
    expect(r.charms).toHaveLength(200)
    expect(r.charms[199].id).toBe('c199')
    expect(r.issues[0]).toMatchObject({ index: 200 })
    expect(st.m.has(CHARMS_BACKUP_KEY)).toBe(true)
  })

  it('never throws when getItem throws', () => {
    const st: StorageLike = { getItem: () => { throw new Error('denied') }, setItem: () => {} }
    expect(loadCharms(data, st)).toMatchObject({ charms: [], issues: [{ reason: expect.stringContaining('denied') }] })
  })

  it('reports a failing backup write instead of throwing', () => {
    const st: StorageLike = { getItem: () => '{nope', setItem: () => { throw new Error('quota') } }
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
  it('trims names and enforces 1 to 40 characters', () => {
    expect(validateCharmInput(data, { ...ok, name: '  Hi  ' })).toMatchObject({ ok: true, charm: { name: 'Hi' } })
    expect(validateCharmInput(data, { ...ok, name: 'x'.repeat(40) }).ok).toBe(true)
    expect(validateCharmInput(data, { ...ok, name: 'x'.repeat(41) }).ok).toBe(false)
    expect(validateCharmInput(data, { ...ok, name: '   ' }).ok).toBe(false)
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
    ['points over 99', { skills: { '1': 100 } }],
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
    expect(createCharm(data, { name: '', slots: 1, skills: {} }, () => 'x').ok).toBe(false)
    expect(createCharm(data, { name: 'n', slots: 1, skills: {} }).ok).toBe(true)
  })
})
