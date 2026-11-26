import { describe, expect, it } from 'vitest'
import { mkData } from '@/state/fixtures'
import { DATA_FILES, DataLoadError, loadGameData, SUPPORTED_DATA_VERSION } from './load'

// Smallest valid files: empty collections plus a valid meta.
const files = (): Record<string, unknown> => {
  const d = mkData()
  return { ...d, meta: { ...d.meta, dataVersion: SUPPORTED_DATA_VERSION } }
}

const fakeFetch =
  (data: Record<string, unknown>, override: (url: string) => Response | Error | undefined = () => undefined): typeof fetch =>
  async (input) => {
    const url = String(input)
    const o = override(url)
    if (o instanceof Error) throw o
    if (o) return o
    const name = /\/data\/(\w+)\.json$/.exec(url)![1]
    return new Response(JSON.stringify(data[name]), { status: 200 })
  }

const failure = async (p: Promise<unknown>) => {
  try {
    await p
  } catch (e) {
    return e as DataLoadError
  }
  throw new Error('expected rejection')
}

describe('loadGameData', () => {
  it('loads all files from ${baseUrl}data/', async () => {
    const urls: string[] = []
    const f = fakeFetch(files(), (u) => (urls.push(u), undefined))
    const data = await loadGameData('/base/', f)
    expect(data.armor).toEqual([])
    expect(urls.sort()).toEqual(DATA_FILES.map((n) => `/base/data/${n}.json`).sort())
  })

  it('revalidates every data file (cache: no-cache), including on a second load (Retry)', async () => {
    const seen: { url: string; cache: RequestCache | undefined }[] = []
    const inner = fakeFetch(files())
    const f: typeof fetch = async (input, init) => (seen.push({ url: String(input), cache: init?.cache }), inner(input, init))
    await loadGameData('/', f)
    await loadGameData('/', f)
    expect(seen).toHaveLength(DATA_FILES.length * 2)
    expect(seen.every((s) => s.cache === 'no-cache')).toBe(true)
  })

  it('reports a 404 with the file name', async () => {
    const e = await failure(loadGameData('/', fakeFetch(files(), (u) => (u.endsWith('armor.json') ? new Response('', { status: 404 }) : undefined))))
    expect(e).toBeInstanceOf(DataLoadError)
    expect(e.file).toBe('armor')
    expect(e.message).toContain('404')
  })

  it('reports a network error with the file name', async () => {
    const e = await failure(loadGameData('/', fakeFetch(files(), (u) => (u.endsWith('horn.json') ? new TypeError('offline') : undefined))))
    expect(e.file).toBe('horn')
  })

  it('reports malformed JSON', async () => {
    const e = await failure(loadGameData('/', fakeFetch(files(), (u) => (u.endsWith('items.json') ? new Response('{nope', { status: 200 }) : undefined))))
    expect(e.file).toBe('items')
    expect(e.message).toContain('invalid JSON')
  })

  it('reports a corrupted file as a validation failure naming the file', async () => {
    const data = { ...files(), skills: [{ id: 'x', name: 'n', tiers: [] }] }
    const e = await failure(loadGameData('/', fakeFetch(data)))
    expect(e.file).toBe('skills')
    expect(e.message).toContain('skills[0].id')
  })

  it('rejects an unsupported dataVersion', async () => {
    const data = files() as { meta: Record<string, unknown> }
    data.meta.dataVersion = SUPPORTED_DATA_VERSION + 1
    const e = await failure(loadGameData('/', fakeFetch(data)))
    expect(e.file).toBe('meta')
    expect(e.message).toContain('dataVersion')
  })
})
