import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { SkillTree, Weapon } from '@/data/types'
import { applyAction, emptyBuild, type BuildContext } from '@/state/build'
import { chooseSharpness, computeDamage, INITIAL_CONTROLS, setToggle, type DamageControls } from '@/state/damageControls'
import { deriveBuild } from '@/state/derive'
import { mkArmor, mkData, mkWeapon } from '@/state/fixtures'
import type { DamageState } from '@/state/useDamageControls'
import { BuffsCard } from './BuffsCard'
import { DamageCard } from './DamageCard'

const tree = (id: number, name: string, tiers: [number, string][]): SkillTree => ({
  id,
  name,
  tiers: tiers.map(([points, n]) => ({ points, name: n, description: null })),
})
const trees = [
  tree(31, 'Attack', [[20, 'Attack Up (L)']]),
  tree(29, 'Tenderizer', [[10, 'Weakness Exploit']]),
  tree(26, 'Spirit', [[15, 'Challenger +2']]),
]
const WHITE = { base: [0, 0, 0, 0, 0, 1, 0], plus: [0, 0, 0, 0, 0, 1, 0] } as Weapon['sharpness']
const MANY = { base: [1, 1, 1, 1, 1, 1, 0], plus: [1, 1, 1, 1, 1, 1, 1] } as Weapon['sharpness']
const weapons = [
  mkWeapon(1, 0, { attack: 1152, affinity: 30, sharpness: WHITE }), // Great Sword
  mkWeapon(2, 0, { class: 'Hunting Horn', attack: 1248, affinity: 0, sharpness: WHITE }),
  mkWeapon(3, 0, { class: 'Insect Glaive', attack: 744, affinity: 0, sharpness: WHITE }),
  mkWeapon(4, 0, { class: 'Bow', attack: 120 }),
  mkWeapon(5, 0, { attack: 1152, affinity: 0, sharpness: WHITE, element: { type: 'Poison', value: 470 } }),
  mkWeapon(6, 0, { attack: 1152, affinity: 0, sharpness: WHITE, awaken: { type: 'Ice', value: 410 } }),
  mkWeapon(7, 0, { attack: 1152, affinityOptions: [-45, 20], affinity: null, sharpness: WHITE }),
  mkWeapon(8, 0, { attack: 1296, affinity: 0, sharpness: MANY, element: { type: 'Fire', value: 620 } }),
  mkWeapon(9, 0, { class: 'Hunting Horn', attack: 1248, affinity: 0, sharpness: null }),
]
const armors = [
  mkArmor(1, 'head', 0, { skills: { '31': 20 } }),
  mkArmor(2, 'head', 0, { skills: { '29': 10 } }),
  mkArmor(3, 'head', 0, { skills: { '26': 15 } }),
]
const ctx: BuildContext = { data: mkData({ skills: trees, armor: armors, weapons }), charms: [] }

const noop = () => {}
function state(weaponId: number | null, armorId: number | null = null, controls: DamageControls = INITIAL_CONTROLS): DamageState {
  let s = emptyBuild()
  if (weaponId !== null) s = applyAction(s, { type: 'setWeapon', weapon: { kind: 'data', weaponId } }, ctx)
  if (armorId !== null) s = applyAction(s, { type: 'setArmor', slot: 'head', armorId }, ctx)
  return { ...computeDamage(deriveBuild(s, ctx), trees, controls), setToggle: noop, reset: noop, chooseColor: noop }
}
/** Rendered text: markup and React's text-node separators removed. */
const text = (node: React.ReactElement) =>
  renderToStaticMarkup(node).replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
const html = (node: React.ReactElement) => renderToStaticMarkup(node)
const card = (d: DamageState) => text(<DamageCard dmg={d} />)

describe('DamageCard', () => {
  it('Great Sword: EFR true value with the in-game number beside it, and the breakdown', () => {
    const t = card(state(1, 1)) // Attack Up (L) 20, Powercharm and Powertalon on: raw 275
    expect(t).toContain('Effective raw (EFR)')
    expect(t).toContain('390.2 (1873.1 in game)') // 275 * 1.32 * 1.075 = 390.225; * 4.8 = 1873.08
    expect(t).toContain('True raw (weapon) 240.0 (1152 in game)')
    expect(t).toContain('Raw after buffs 275.0 (1320.0 in game)')
    expect(t).toContain('Affinity +30.0%')
    expect(t).toContain('Crit factor ×1.075')
    expect(t).toContain('Sharpness White raw ×1.32 · element ×1.125')
    expect(t).not.toContain('Weakness Exploit')
  })

  it('toggling a buff changes the displayed EFR', () => {
    const before = card(state(1, 1))
    const after = card(state(1, 1, setToggle(setToggle(INITIAL_CONTROLS, 'item:powercharm', false), 'item:powertalon', false)))
    expect(after).toContain('368.9 (1770.9 in game)') // 260 * 1.32 * 1.075 = 368.94
    expect(after).not.toBe(before)
    const noSkill = card(state(1, 1, setToggle(INITIAL_CONTROLS, 'skill:attack', false)))
    expect(noSkill).toContain('True raw (weapon) 240.0')
    expect(noSkill).toContain('Raw after buffs 255.0')
  })

  it('the sharpness selector shows one pressed button per selectable color and changes values', () => {
    const d = state(8)
    const h = html(<DamageCard dmg={d} />)
    expect(h.match(/<button[^>]*aria-pressed="(true|false)"/g)).toHaveLength(6) // red..white
    expect(h).toMatch(/aria-pressed="true"[^>]*>(<[^>]+>)*\s*White/)
    expect(text(<DamageCard dmg={d} />)).toContain('Sharpness (simulate wear or a higher level)')
    const green = card(state(8, null, chooseSharpness(INITIAL_CONTROLS, 8, 3)))
    expect(green).toContain('Sharpness Green raw ×1.05 · element ×1.00')
    expect(green).toContain('Effective element: Fire 620.0') // element x1.00 at green
    expect(card(d)).toContain('Effective element: Fire 697.5') // 620 * 1.125 at white
  })

  it('Weakness Exploit note only when the flag is set', () => {
    expect(card(state(1, 2))).toContain('Weakness Exploit: +5 to hitzones of 45 or more.')
    expect(card(state(1, 2))).toContain('Not included in EFR.')
    expect(card(state(1, 2, setToggle(INITIAL_CONTROLS, 'skill:tenderizer', false)))).not.toContain('Weakness Exploit')
  })

  it('a status weapon: status label and the buildup note', () => {
    const t = card(state(5))
    expect(t).toContain('Effective status: Poison 470.0')
    expect(t).toContain('Higher value means faster buildup, not more damage.')
    expect(card(state(8))).not.toContain('Higher value means faster buildup')
  })

  it('a locked awaken weapon says so', () => {
    expect(card(state(6))).toContain('Awaken element inactive: needs the Awaken skill')
    expect(card(state(1))).not.toContain('Awaken element inactive')
  })

  it('double affinity adds the average note', () => {
    expect(card(state(7))).toContain('Affinity −12.5% average of two values')
    expect(card(state(1))).not.toContain('average of two values')
  })

  it('a gunner shows the reason and the true raw, no EFR', () => {
    const t = card(state(4))
    expect(t).toContain('Gunner damage is not modeled yet.')
    expect(t).toContain('True raw (weapon) 100.0 (120 in game)')
    expect(t).not.toContain('Effective raw')
    expect(html(<DamageCard dmg={state(4)} />)).not.toContain('aria-pressed')
  })

  it('no usable sharpness: reason, still the true raw', () => {
    const t = card(state(9))
    expect(t).toContain('No usable sharpness data for this weapon.')
    expect(t).toContain('True raw (weapon) 240.0 (1248 in game)')
  })

  it('no weapon: an empty state', () => {
    expect(card(state(null))).toContain('Equip a weapon to see effective raw and element.')
  })

  it('does not use the style prop or hover-only titles', () => {
    const h = html(<DamageCard dmg={state(8, 2)} />) + html(<BuffsCard dmg={state(2, 1)} />)
    expect(h).not.toMatch(/\sstyle="/)
    expect(h).not.toMatch(/\stitle="/)
  })
})

describe('BuffsCard', () => {
  const buffs = (d: DamageState) => text(<BuffsCard dmg={d} />)
  const pressed = (d: DamageState) => [...html(<BuffsCard dmg={d} />).matchAll(/<button[^>]*aria-pressed="(true|false)"[^>]*>(.*?)<\/button>/g)].map((m) => [m[2].replace(/<[^>]+>/g, ''), m[1]])

  it('Great Sword: Attack section, the skills of the build, items; no songs or kinsect', () => {
    const d = state(1, 1)
    const t = buffs(d)
    expect(t).toContain('Buffs')
    expect(t).toContain('Reset buffs')
    expect(t).toContain('Attack Skills Attack Up (L)')
    expect(t).toContain('Items')
    expect(t).not.toContain('Songs')
    expect(t).not.toContain('Kinsect')
    expect(t).not.toContain('Defense')
    expect(pressed(d)).toEqual([['Attack Up (L)', 'true'], ['Powercharm', 'true'], ['Powertalon', 'true']])
  })

  it('bullets show their state: off after a toggle', () => {
    const off = setToggle(INITIAL_CONTROLS, 'item:powertalon', false)
    expect(pressed(state(1, 1, off))).toContainEqual(['Powertalon', 'false'])
  })

  it('a conditional skill shows its condition', () => {
    expect(pressed(state(1, 3))).toContainEqual(['Challenger +2: raged monster', 'true'])
  })

  it('Hunting Horn: songs with the note about notes', () => {
    const t = buffs(state(2))
    expect(t).toContain('Songs')
    expect(t).toContain('Songs are not yet limited to the horn')
    expect(pressed(state(2)).map((p) => p[0])).toEqual(['Powercharm', 'Powertalon', 'Attack Up (S)', 'Attack Up (L)', 'Affinity Up', 'Element Up'])
  })

  it('Insect Glaive: kinsect toggles and the combination as text', () => {
    expect(buffs(state(3))).toContain('Kinsect Red White Orange Triple Up +25% raw')
    const noOrange = setToggle(INITIAL_CONTROLS, 'kinsect:orange', false)
    expect(buffs(state(3, null, noOrange))).toContain('Red + White +20% raw')
    const none = setToggle(setToggle(INITIAL_CONTROLS, 'kinsect:orange', false), 'kinsect:red', false)
    expect(buffs(state(3, null, none))).toContain('No combination active')
  })

  it('no weapon: an empty state and no reset button', () => {
    const t = buffs(state(null))
    expect(t).toContain('Equip a weapon to see buffs.')
    expect(t).not.toContain('Reset buffs')
  })

  it('every bullet has a check box (not only color) and visible text', () => {
    const h = html(<BuffsCard dmg={state(1, 1)} />)
    expect(h.match(/<svg/g)).toHaveLength(3)
  })
})
