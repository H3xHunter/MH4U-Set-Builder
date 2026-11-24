export interface SlotUsage {
  used: number
  /** Never negative; `ok` tells whether the capacity was exceeded. */
  free: number
  ok: boolean
}

type Sized = { size: number }

/** Slot positions don't matter: a size-N decoration uses N slots. */
export function slotUsage(slots: number, decorations: readonly Sized[]): SlotUsage {
  const used = decorations.reduce((sum, d) => sum + d.size, 0)
  return { used, free: Math.max(0, slots - used), ok: used <= slots }
}

export const canAdd = (slots: number, decorations: readonly Sized[], candidate: Sized): boolean =>
  slotUsage(slots, [...decorations, candidate]).ok
