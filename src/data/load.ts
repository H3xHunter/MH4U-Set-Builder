import type { GameData } from './types'
import { DataValidationError, validateGameData } from './validate'

export const SUPPORTED_DATA_VERSION = 1

export const DATA_FILES = [
  'meta',
  'skills',
  'armor',
  'decorations',
  'weapons',
  'horn',
  'materials',
  'monsters',
  'locations',
  'quests',
  'items',
] as const

export class DataLoadError extends Error {
  readonly file: string
  constructor(file: string, message: string, options?: ErrorOptions) {
    super(`${file}.json: ${message}`, options)
    this.name = 'DataLoadError'
    this.file = file
  }
}

async function fetchJson(baseUrl: string, file: string, fetchFn: typeof fetch): Promise<unknown> {
  let res: Response
  try {
    // The files are not content-hashed and Pages caches them for 10 minutes: revalidate (etag, so usually a 304)
    // instead of mixing a new app with old data.
    res = await fetchFn(`${baseUrl}data/${file}.json`, { cache: 'no-cache' })
  } catch (cause) {
    throw new DataLoadError(file, 'network error', { cause })
  }
  if (res.status !== 200) throw new DataLoadError(file, `HTTP ${res.status}`)
  try {
    return await res.json()
  } catch (cause) {
    throw new DataLoadError(file, 'invalid JSON', { cause })
  }
}

/** `baseUrl` must end with a slash (e.g. Vite's `import.meta.env.BASE_URL`). */
export async function loadGameData(baseUrl: string, fetchFn: typeof fetch = fetch): Promise<GameData> {
  const parts = await Promise.all(DATA_FILES.map((f) => fetchJson(baseUrl, f, fetchFn)))
  const raw = Object.fromEntries(DATA_FILES.map((f, i) => [f, parts[i]]))

  // Checked before validation: a newer version may legitimately have a different shape.
  const version = (raw.meta as { dataVersion?: unknown } | null)?.dataVersion
  if (typeof version === 'number' && version !== SUPPORTED_DATA_VERSION) {
    throw new DataLoadError('meta', `unsupported dataVersion ${version} (supported: ${SUPPORTED_DATA_VERSION})`)
  }
  try {
    return validateGameData(raw)
  } catch (e) {
    if (e instanceof DataValidationError) {
      // The first path segment is the file name, e.g. `armor[12].skills.3`.
      throw new DataLoadError(e.path.split(/[.[]/)[0], e.message, { cause: e })
    }
    throw e
  }
}
