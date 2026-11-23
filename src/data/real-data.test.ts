/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { validateGameData } from './validate'

const NAMES = ['meta', 'skills', 'armor', 'decorations', 'weapons', 'horn', 'materials', 'monsters', 'locations', 'quests', 'items']

describe('public/data', () => {
  it('passes validateGameData and matches meta.counts', () => {
    const raw = Object.fromEntries(
      NAMES.map((n) => [n, JSON.parse(readFileSync(new URL(`../../public/data/${n}.json`, import.meta.url), 'utf8'))]),
    )
    const data = validateGameData(raw)
    for (const [k, v] of Object.entries(data.meta.counts)) expect((data as unknown as Record<string, unknown[]>)[k]).toHaveLength(v)
  })
})
