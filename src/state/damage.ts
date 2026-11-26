import { calculateDamage, type DamageResult, type DamageToggles, type SkillTotals } from '@/lib/damage'
import type { DerivedBuild } from './derive'

/** Total skill points per tree id of the build (what the skill bars show). */
export const skillTotals = (skills: DerivedBuild['skills']): SkillTotals => Object.fromEntries(skills.map((r) => [r.treeId, r.total]))

/** Damage of the current build; null while no data weapon is equipped (a custom slots-only weapon has no attack). */
export function deriveDamage(d: DerivedBuild, toggles: DamageToggles, sharpnessColor?: number): DamageResult | null {
  if (!d.weapon) return null
  return calculateDamage({ weapon: d.weapon, skills: skillTotals(d.skills), toggles, sharpnessColor })
}
