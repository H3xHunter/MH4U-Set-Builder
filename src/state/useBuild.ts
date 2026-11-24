import { useCallback, useMemo, useReducer, useState } from 'react'
import { ARMOR_SLOTS, type ArmorSlot, type GameData, type SavedCharm } from '@/data/types'
import { loadCharms } from '@/lib/charms'
import {
  applyAction,
  canAddDeco,
  capacityOf,
  emptyBuild,
  normalizeBuild,
  type Action,
  type BuildContext,
  type BuildState,
  type Target,
} from './build'
import { deriveBuild, type DerivedBuild } from './derive'

type HookAction = Action | { type: 'normalize' }

export const makeReducer = (ctx: BuildContext) => (state: BuildState, action: HookAction) =>
  action.type === 'normalize' ? normalizeBuild(state, ctx) : applyAction(state, action, ctx)

/**
 * "Slots used X / Y": X is the decorations placed, Y the decoration capacity of what is equipped.
 * An item that is not equipped (no weapon, no charm, empty armor slot) has capacity 0.
 */
export function slotTotals(build: BuildState, derived: DerivedBuild, ctx: BuildContext) {
  const targets: Target[] = [{ kind: 'weapon' }, { kind: 'charm' }, ...ARMOR_SLOTS.map((slot): Target => ({ kind: 'armor', slot }))]
  const { weapon, charm, armor } = derived.slotUsage
  return {
    used: weapon.used + charm.used + ARMOR_SLOTS.reduce((n, s) => n + armor[s].used, 0),
    capacity: targets.reduce((n, t) => n + capacityOf(build, t, ctx), 0),
  }
}

export function useBuild(data: GameData) {
  const [charms, setCharmsState] = useState<SavedCharm[]>(() => loadCharms(data).charms)
  const ctx = useMemo<BuildContext>(() => ({ data, charms }), [data, charms])
  const reducer = useMemo(() => makeReducer(ctx), [ctx])
  const [build, dispatch] = useReducer(reducer, null, emptyBuild)

  const derived = useMemo(() => deriveBuild(build, ctx), [build, ctx])
  const treeNames = useMemo(() => new Map(data.skills.map((t) => [t.id, t.name])), [data])

  return {
    ctx,
    build,
    derived,
    treeNames,
    totals: slotTotals(build, derived, ctx),
    dispatch,
    /** Changing the charm list can invalidate decorations in the charm, so the build is normalized after it. */
    setCharms: useCallback((next: SavedCharm[]) => {
      setCharmsState(next)
      dispatch({ type: 'normalize' })
    }, []),
    equipArmor: useCallback((slot: ArmorSlot, armorId: number) => dispatch({ type: 'setArmor', slot, armorId }), []),
    removeArmor: useCallback((slot: ArmorSlot) => dispatch({ type: 'setArmor', slot, armorId: null }), []),
    addDeco: useCallback((target: Target, decoId: number) => dispatch({ type: 'addDeco', target, decoId }), []),
    removeDeco: useCallback((target: Target, index: number) => dispatch({ type: 'removeDeco', target, index }), []),
    canAddDeco: useCallback((target: Target, decoId: number) => canAddDeco(build, target, decoId, ctx), [build, ctx]),
  }
}
