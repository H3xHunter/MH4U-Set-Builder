/// <reference types="node" />
// Test-only: the real converted data, validated. Not imported by app code.
import { readFileSync } from 'node:fs'
import { DATA_FILES } from './load'
import type { GameData } from './types'
import { validateGameData } from './validate'

export const loadRealData = (): GameData =>
  validateGameData(
    Object.fromEntries(
      DATA_FILES.map((n) => [n, JSON.parse(readFileSync(new URL(`../../public/data/${n}.json`, import.meta.url), 'utf8'))]),
    ),
  )
