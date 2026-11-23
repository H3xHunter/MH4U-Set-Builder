import { describe, expect, it } from 'vitest'
import { canAdd, slotUsage } from './slots'

const d = (size: number) => ({ size })

describe('slotUsage', () => {
  it('sums sizes, positions irrelevant', () => {
    expect(slotUsage(3, [d(1), d(2)])).toEqual({ used: 3, free: 0, ok: true })
    expect(slotUsage(3, [d(2), d(1)])).toEqual({ used: 3, free: 0, ok: true })
  })
  it('handles empty and spare capacity', () => {
    expect(slotUsage(0, [])).toEqual({ used: 0, free: 0, ok: true })
    expect(slotUsage(3, [d(1)])).toEqual({ used: 1, free: 2, ok: true })
  })
  it('flags overflow with free clamped to 0', () => {
    expect(slotUsage(2, [d(3)])).toEqual({ used: 3, free: 0, ok: false })
    expect(slotUsage(0, [d(1)]).ok).toBe(false)
  })
})

describe('canAdd', () => {
  it('accepts a candidate that fits exactly', () => expect(canAdd(3, [d(1)], d(2))).toBe(true))
  it('rejects a candidate that overflows', () => expect(canAdd(3, [d(2)], d(2))).toBe(false))
  it('rejects anything on a 0-slot piece', () => expect(canAdd(0, [], d(1))).toBe(false))
})
