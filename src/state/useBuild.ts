import { useCallback, useMemo, useReducer, useState } from 'react'
import { ARMOR_SLOTS, type ArmorSlot, type GameData, type SavedCharm } from '@/data/types'
import {
  addCharm,
  deleteCharm,
  duplicateCharm,
  loadCharms,
  saveCharms,
  updateCharm,
  type CharmInput,
  type CharmIssue,
} from '@/lib/charms'
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
  const [loaded] = useState(() => loadCharms(data))
  const [charms, setCharmsState] = useState<SavedCharm[]>(loaded.charms)
  const [storageError, setStorageError] = useState<string | null>(null)
  const ctx = useMemo<BuildContext>(() => ({ data, charms }), [data, charms])
  const reducer = useMemo(() => makeReducer(ctx), [ctx])
  const [build, dispatch] = useReducer(reducer, null, emptyBuild)

  const commit = useCallback(
    (next: SavedCharm[]) => {
      setCharmsState(next)
      const saved = saveCharms(data, next)
      setStorageError(saved.ok ? null : saved.reason)
      dispatch({ type: 'normalize' })
    },
    [data],
  )

  const derived = useMemo(() => deriveBuild(build, ctx), [build, ctx])
  const treeNames = useMemo(() => new Map(data.skills.map((t) => [t.id, t.name])), [data])

  return {
    ctx,
    build,
    derived,
    treeNames,
    totals: slotTotals(build, derived, ctx),
    dispatch,
    /** Why some stored charms could not be loaded (they are kept in a backup key), if any. */
    charmIssues: loaded.issues as readonly CharmIssue[],
    /** Set when the last save to browser storage failed; the list in memory is still current. */
    storageError,
    /**
     * Charm list changes: the new list is kept in memory first, then written to storage. A failed write is
     * reported in `storageError` and never loses the in-memory list. The build is normalized after every change,
     * so deleting the equipped charm unequips it and a smaller slot count drops the decorations that no longer fit.
     */
    saveCharm: useCallback(
      (input: CharmInput, id: string | null) => {
        const r = id === null ? addCharm(data, charms, input) : updateCharm(data, charms, id, input)
        if (r.ok) commit(r.charms)
        return r
      },
      [data, charms, commit],
    ),
    removeCharm: useCallback((id: string) => commit(deleteCharm(charms, id)), [charms, commit]),
    copyCharm: useCallback(
      (id: string) => {
        const r = duplicateCharm(data, charms, id)
        if (r.ok) commit(r.charms)
        return r
      },
      [data, charms, commit],
    ),
    equipCharm: useCallback((charmId: string | null) => dispatch({ type: 'setCharm', charmId }), []),
    equipArmor: useCallback((slot: ArmorSlot, armorId: number) => dispatch({ type: 'setArmor', slot, armorId }), []),
    removeArmor: useCallback((slot: ArmorSlot) => dispatch({ type: 'setArmor', slot, armorId: null }), []),
    addDeco: useCallback((target: Target, decoId: number) => dispatch({ type: 'addDeco', target, decoId }), []),
    removeDeco: useCallback((target: Target, index: number) => dispatch({ type: 'removeDeco', target, index }), []),
    canAddDeco: useCallback((target: Target, decoId: number) => canAddDeco(build, target, decoId, ctx), [build, ctx]),
  }
}
