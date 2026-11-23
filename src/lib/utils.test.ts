import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('merges class names and resolves Tailwind conflicts', () => {
    const hidden = false as boolean
    expect(cn('px-2', 'px-4', hidden && 'hidden')).toBe('px-4')
  })
})
