/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DECORATION_COLORS } from '@/data/types'

const css = readFileSync(new URL('./index.css', import.meta.url), 'utf8')
const defined = (name: string) => new RegExp(`^\\s*--${name}:`, 'm').test(css)
const range = Array.from({ length: 10 }, (_, i) => i + 1)

describe('index.css tokens', () => {
  it.each(range)('defines rarity %i tint and text', (n) => {
    expect(defined(`rarity-${n}`)).toBe(true)
    expect(defined(`rarity-text-${n}`)).toBe(true)
  })

  it.each(DECORATION_COLORS)('defines the %s jewel token', (c) => {
    expect(defined(`jewel-${c}`)).toBe(true)
  })

  it.each([
    'background', 'foreground', 'surface', 'card', 'card-foreground', 'popover', 'popover-foreground',
    'border', 'input', 'ring', 'muted', 'muted-foreground', 'primary', 'primary-foreground',
    'secondary', 'secondary-foreground', 'accent', 'accent-foreground', 'destructive', 'row-hover',
    'skill-positive', 'skill-negative', 'deco-total', 'torso-up-extra', 'slot-free', 'slot-used', 'slot-invalid',
  ])('defines the %s semantic token and its Tailwind color', (t) => {
    expect(defined(t)).toBe(true)
    expect(defined(`color-${t}`)).toBe(true)
  })
})
