import { describe, expect, it } from 'vitest'
import { isBackdropClose } from './backdrop'

describe('isBackdropClose', () => {
  const dialog = new EventTarget()
  const panel = new EventTarget()
  it('press and click on the dialog closes', () => expect(isBackdropClose(dialog, dialog, dialog)).toBe(true))
  it('press inside the panel, release on the dialog does not close', () => expect(isBackdropClose(panel, dialog, dialog)).toBe(false))
  it('press on the dialog, release inside the panel does not close', () => expect(isBackdropClose(dialog, panel, dialog)).toBe(false))
  it('a click with no press (keyboard activation, script) does not close', () => expect(isBackdropClose(null, dialog, dialog)).toBe(false))
})
