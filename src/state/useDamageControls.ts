import { useCallback, useMemo, useState } from 'react'
import {
  chooseSharpness,
  computeDamage,
  INITIAL_CONTROLS,
  resetToggles,
  setToggle,
  type DamageView,
} from './damageControls'
import type { useBuild } from './useBuild'

/** What the damage and buffs cards need: the computed view plus the ways to change the controls. */
export type DamageState = DamageView & {
  setToggle: (id: string, on: boolean) => void
  reset: () => void
  chooseColor: (color: number) => void
}

/** The damage result of the build plus its session-only controls (toggles, sharpness color). Nothing is persisted. */
export function useDamageControls(b: ReturnType<typeof useBuild>): DamageState {
  const [controls, setControls] = useState(INITIAL_CONTROLS)
  const view = useMemo(() => computeDamage(b.derived, b.ctx.data.skills, controls), [b.derived, b.ctx.data.skills, controls])
  if (view.controls !== controls) setControls(view.controls)
  const weaponId = view.weapon?.id
  return {
    ...view,
    setToggle: useCallback((id: string, on: boolean) => setControls((c) => setToggle(c, id, on)), []),
    reset: useCallback(() => setControls(resetToggles), []),
    chooseColor: useCallback((color: number) => weaponId !== undefined && setControls((c) => chooseSharpness(c, weaponId, color)), [weaponId]),
  }
}
