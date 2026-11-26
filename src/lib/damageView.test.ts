import { describe, expect, it } from 'vitest'
import type { DamageResult } from './damage'
import { efeSummary, efrSummary, formatDecimal, formatFactor, formatSignedDecimal, instanceLabel, SHARPNESS_NAMES } from './damageView'

const ok = (instances: { kind: 'element' | 'status'; effectiveShown: number }[], efrTrue = 377.454): DamageResult =>
  ({ ok: true, efrTrue, instances: instances.map((i) => ({ slot: 'element', type: 'Fire', shownBase: 1, ...i })) }) as unknown as DamageResult

describe('formatDecimal', () => {
  it('one decimal, rounded', () => {
    expect(formatDecimal(377.454)).toBe('377.5')
    expect(formatDecimal(1811.7792)).toBe('1811.8')
    expect(formatDecimal(240)).toBe('240.0')
    expect(formatDecimal(0.04)).toBe('0.0')
  })
  it('never prints negative zero; non-finite is an en dash', () => {
    expect(formatDecimal(-0.04)).toBe('0.0')
    expect(formatDecimal(-0)).toBe('0.0')
    expect(formatDecimal(NaN)).toBe('–')
    expect(formatDecimal(Infinity)).toBe('–')
  })
})

describe('formatSignedDecimal', () => {
  it('sign and real minus', () => {
    expect(formatSignedDecimal(30)).toBe('+30.0')
    expect(formatSignedDecimal(-12.5)).toBe('−12.5')
    expect(formatSignedDecimal(0)).toBe('0.0')
    expect(formatSignedDecimal(-0.01)).toBe('0.0')
    expect(formatSignedDecimal(NaN)).toBe('–')
  })
})

describe('formatFactor', () => {
  it('keeps the digits of a multiplier, at least two decimals', () => {
    expect(formatFactor(1.075)).toBe('1.075')
    expect(formatFactor(1.32)).toBe('1.32')
    expect(formatFactor(1.0625)).toBe('1.0625')
    expect(formatFactor(0.95)).toBe('0.95')
    expect(formatFactor(1)).toBe('1.00')
    expect(formatFactor(1.2000000000000002)).toBe('1.20')
    expect(formatFactor(NaN)).toBe('–')
  })
})

describe('labels and summaries', () => {
  it('instance labels', () => {
    expect(instanceLabel({ kind: 'element', type: 'Fire' })).toBe('Effective element: Fire')
    expect(instanceLabel({ kind: 'status', type: 'Poison' })).toBe('Effective status: Poison')
    expect(SHARPNESS_NAMES).toHaveLength(7)
  })

  it('EFR summary', () => {
    expect(efrSummary(ok([]))).toBe('377.5')
    expect(efrSummary(null)).toBe('–')
    expect(efrSummary({ ok: false, reason: 'Gunner damage is not modeled yet.', trueRaw: 100 })).toBe('–')
  })

  it('EFE summary: element value, "Status" prefix, both separated by " / ", en dash when none', () => {
    expect(efeSummary(ok([{ kind: 'element', effectiveShown: 697.5 }]))).toBe('697.5')
    expect(efeSummary(ok([{ kind: 'status', effectiveShown: 528.75 }]))).toBe('Status 528.8')
    expect(efeSummary(ok([{ kind: 'element', effectiveShown: 390 }, { kind: 'status', effectiveShown: 112.5 }]))).toBe('390.0 / Status 112.5')
    expect(efeSummary(ok([{ kind: 'element', effectiveShown: 390 }, { kind: 'element', effectiveShown: 145 }]))).toBe('390.0 / 145.0')
    expect(efeSummary(ok([]))).toBe('–')
    expect(efeSummary(null)).toBe('–')
    expect(efeSummary({ ok: false, reason: 'x', trueRaw: null })).toBe('–')
  })
})
