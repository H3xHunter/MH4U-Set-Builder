import { describe, expect, it } from 'vitest'
import { DEFAULT_TOGGLES } from '@/lib/damage'
import type { SkillTree } from '@/data/types'
import { applyAction, emptyBuild, type Action, type BuildContext } from './build'
import { deriveBuild } from './derive'
import { deriveDamage, skillTotals } from './damage'
import { mkArmor, mkData, mkWeapon } from './fixtures'

const trees: SkillTree[] = [{ id: 31, name: 'Attack', tiers: [{ points: 10, name: 'Attack Up (S)', description: null }] }]
const ctx: BuildContext = {
  data: mkData({
    skills: trees,
    armor: [mkArmor(1, 'head', 0, { skills: { '31': 12 } })],
    weapons: [mkWeapon(100, 0, { attack: 480, affinity: 0, sharpness: { base: [0, 0, 0, 0, 0, 1, 0], plus: [0, 0, 0, 0, 0, 1, 0] } })],
  }),
  charms: [],
}
const build = (actions: Action[]) => actions.reduce((s, a) => applyAction(s, a, ctx), emptyBuild())

describe('deriveDamage', () => {
  it('is null without a data weapon', () => {
    expect(deriveDamage(deriveBuild(emptyBuild(), ctx), DEFAULT_TOGGLES)).toBeNull()
  })

  it('uses the build skill totals', () => {
    const d = deriveBuild(build([{ type: 'setArmor', slot: 'head', armorId: 1 }, { type: 'setWeapon', weapon: { kind: 'data', weaponId: 100 } }]), ctx)
    expect(skillTotals(d.skills)).toEqual({ 31: 12 })
    const r = deriveDamage(d, { ...DEFAULT_TOGGLES, raged: false })
    expect(r).toMatchObject({ ok: true, trueRaw: 100, rawBeforeSong: 110 }) // 12 points = tier 10 = +10
  })
})
