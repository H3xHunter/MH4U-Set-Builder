import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { loadRealData } from '@/data/real-data-fixture'
import type { Weapon } from '@/data/types'
import { trueRaw } from '@/lib/damage'
import { WeaponHeader, WeaponRow } from './WeaponPicker'

const data = loadRealData()
const real = (id: number): Weapon => {
  const w = data.weapons.find((x) => x.id === id)
  if (!w) throw new Error(`weapon ${id}`)
  return w
}
const noop = () => {}
const row = (w: Weapon) =>
  renderToStaticMarkup(
    <ul>
      <WeaponRow row={{ weapon: w, depth: 0, hasChildren: false, parentId: null, context: false, expanded: false }} id="r" active={false} foldable={false} onPick={noop} onToggle={noop} />
    </ul>,
  )
const text = (html: string) => html.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

// [class, real id, attack, expected true raw]
const CASES = [
  ['Great Sword', 5014, 1152, 240],
  ['Hunting Horn', 5984, 1248, 240],
  ['Insect Glaive', 6746, 713, 230],
  ['Bow', 7169, 300, 250],
  ['Light Bowgun', 6874, 377, 290],
  ['Heavy Bowgun', 7035, 435, 290],
] as const

describe('weapon picker: True column', () => {
  it('the header has True right after Attack', () => {
    const cols = [...renderToStaticMarkup(<WeaponHeader />).matchAll(/<span[^>]*>([^<]+)<\/span>/g)].map((m) => m[1])
    expect(cols).toEqual(['Name', 'Attack', 'True', 'Affinity', 'Element', 'Slots'])
  })

  it.each(CASES)('%s %i: attack %i shows true raw %i, without decimals', (cls, id, attack, expected) => {
    const w = real(id)
    expect(w).toMatchObject({ class: cls, attack })
    expect(trueRaw(w)).toBe(expected)
    const html = row(w)
    // The desktop cell: Attack, then True, as plain integers.
    expect(html).toContain(`<span class="font-mono md:text-sm">${attack}</span></span><span><span class="text-muted-foreground md:hidden">True </span><span class="font-mono md:text-sm">${expected}</span>`)
    expect(html).not.toContain(`${expected}.`)
  })

  it.each(CASES)('%s %i: the narrow line carries a visible "True" label and the value', (_cls, id, attack, expected) => {
    const t = text(row(real(id)))
    expect(t).toContain(`Atk ${attack} True ${expected} Aff`)
  })

  it('an unknown class shows a dash instead of a number', () => {
    expect(text(row({ ...real(5014), class: 'Spoon' }))).toContain('True -')
  })

  it('uses no style prop for the new cell and no hover-only title for it', () => {
    const cell = row(real(5014)).match(/True <\/span>.*?<\/span>/)?.[0] ?? ''
    expect(cell).not.toMatch(/style=|title=/)
  })
})
