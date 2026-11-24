/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ARMOR_SLOTS, DECORATION_COLORS } from '@/data/types'
import { armorIcon, charmIcon, decorationIcon, ICON_SIZE, WEAPON_CLASSES, weaponIcon } from './icons'

const dir = new URL('../assets/icons/', import.meta.url)
const data = (n: string) => JSON.parse(readFileSync(new URL(`../../public/data/${n}.json`, import.meta.url), 'utf8'))
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const files = (sub: string) =>
  readdirSync(new URL(`${sub}/`, dir))
    .filter((f) => f !== 'NOTICE.md')
    .map((f) => ({ name: `${sub}/${f}`, buf: readFileSync(new URL(`${sub}/${f}`, dir)) }))
const size = (b: Buffer) => `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}` // IHDR width, height

describe('icon lookup', () => {
  it('has an icon for every armor slot used in the data', () => {
    const slots = new Set<string>(data('armor').map((a: { slot: string }) => a.slot))
    expect([...slots].sort()).toEqual([...ARMOR_SLOTS].sort())
    for (const s of ARMOR_SLOTS) expect(armorIcon(s), s).toBeTypeOf('string')
  })
  it('has an icon for every weapon class used in the data', () => {
    const classes = new Set<string>(data('weapons').map((w: { class: string }) => w.class))
    expect([...classes].sort()).toEqual([...WEAPON_CLASSES].sort())
    for (const c of classes) expect(weaponIcon(c), c).toBeTypeOf('string')
  })
  it('has the decoration and charm icons, and a tint token for every color and rarity', () => {
    expect(decorationIcon()).toBeTypeOf('string')
    expect(charmIcon()).toBeTypeOf('string')
    const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
    for (const c of DECORATION_COLORS) expect(css, c).toContain(`--jewel-${c}:`)
    for (let r = 1; r <= 10; r++) expect(css, `rarity ${r}`).toContain(`--rarity-${r}:`)
  })
  it('returns undefined for unknown keys', () => {
    expect(weaponIcon('Nonexistent Blade')).toBeUndefined()
    expect(armorIcon('feet' as 'head')).toBeUndefined()
    expect(weaponIcon('../armor/head')).toBeUndefined()
  })
})

describe('icon files', () => {
  const all = [...files('armor'), ...files('weapons'), ...files('misc')]
  it('are PNGs', () => {
    expect(all).toHaveLength(ARMOR_SLOTS.length + WEAPON_CLASSES.length + 2)
    for (const f of all) expect(f.buf.subarray(0, 8).equals(PNG), f.name).toBe(true)
  })
  it('share one pixel size per category, matching ICON_SIZE', () => {
    const sizes = (fs: { buf: Buffer }[]) => new Set(fs.map((f) => size(f.buf)))
    expect(sizes(files('armor'))).toEqual(new Set([`${ICON_SIZE.armor}x${ICON_SIZE.armor}`]))
    expect(sizes(files('weapons'))).toEqual(new Set([`${ICON_SIZE.weapon}x${ICON_SIZE.weapon}`]))
    const misc = Object.fromEntries(files('misc').map((f) => [f.name, size(f.buf)]))
    expect(misc['misc/decoration.png']).toBe(`${ICON_SIZE.decoration}x${ICON_SIZE.decoration}`)
    expect(misc['misc/charm.png']).toBe(`${ICON_SIZE.charm}x${ICON_SIZE.charm}`)
  })
})
