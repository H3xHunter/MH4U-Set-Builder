import type { SkillTree } from '@/data/types'
import { BUFFS } from '@/lib/buffRegistry'
import { activeKinsect, defaultToggles, listToggles, type Registry } from '@/lib/damage'
import { deriveDamage, skillTotals } from './damage'
import type { DerivedBuild } from './derive'

/*
 * Session-only damage controls: toggle overrides over the registry defaults, and the chosen sharpness color.
 * Pure functions on a plain object; nothing is stored anywhere (persistence comes later, by buff id).
 */
export interface DamageControls {
  /** Only the ids whose state differs from the registry default. */
  overrides: Readonly<Record<string, boolean>>
  /** The color chosen for one weapon; it belongs to that weapon only. */
  sharpness: { weaponId: number; color: number } | null
}

export const INITIAL_CONTROLS: DamageControls = { overrides: {}, sharpness: null }

/** The full toggle map: registry defaults with the overrides on top. */
export const resolveToggles = (c: DamageControls, registry: Registry = BUFFS): Record<string, boolean> => ({
  ...defaultToggles(registry),
  ...c.overrides,
})

export function setToggle(c: DamageControls, id: string, on: boolean, registry: Registry = BUFFS): DamageControls {
  const defaults = defaultToggles(registry)
  if (!Object.hasOwn(defaults, id)) return c
  const overrides = { ...c.overrides }
  if (on === defaults[id]) delete overrides[id]
  else overrides[id] = on
  return { ...c, overrides }
}

/** "Reset buffs": every toggle back to its default. The chosen sharpness color stays. */
export const resetToggles = (c: DamageControls): DamageControls => ({ ...c, overrides: {} })

export const chooseSharpness = (c: DamageControls, weaponId: number, color: number): DamageControls => ({ ...c, sharpness: { weaponId, color } })
export const clearSharpness = (c: DamageControls): DamageControls => ({ ...c, sharpness: null })

/** The color to pass to the calculation: the chosen one, only while the same weapon is equipped. */
export const sharpnessFor = (c: DamageControls, weaponId: number | null): number | undefined =>
  c.sharpness && c.sharpness.weaponId === weaponId ? c.sharpness.color : undefined

/**
 * Everything the damage and buffs cards show for the current build and controls. `controls` is the controls to keep:
 * a chosen sharpness color that the active bar no longer has (Handicraft switched off, say) is cleared, so the top
 * color is used for good.
 */
export function computeDamage(d: DerivedBuild, trees: readonly SkillTree[], controls: DamageControls) {
  const weapon = d.weapon
  const toggles = resolveToggles(controls)
  const color = sharpnessFor(controls, weapon?.id ?? null)
  const result = deriveDamage(d, toggles, color)
  const totals = skillTotals(d.skills)
  const stale = color !== undefined && result?.ok === true && result.sharpness.selected !== color
  return {
    weapon,
    result,
    groups: weapon ? listToggles(weapon, totals, undefined, trees) : [],
    toggles,
    kinsect: weapon ? activeKinsect(weapon, totals, toggles) : null,
    sharpnessColor: color,
    controls: stale ? clearSharpness(controls) : controls,
  }
}
export type DamageView = ReturnType<typeof computeDamage>
