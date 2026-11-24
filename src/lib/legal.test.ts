import { describe, expect, it } from 'vitest'
import { FAN_DISCLAIMER } from './legal'

describe('FAN_DISCLAIMER', () => {
  it('is the exact owner-approved text', () => {
    expect(FAN_DISCLAIMER).toBe(
      'This is a fan-made project and is not affiliated with or endorsed by Capcom. Monster Hunter and all related content belongs to ©CAPCOM CO., LTD.',
    )
  })
})
