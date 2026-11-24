/**
 * A backdrop click closes a dialog only when the press and the click both landed on the dialog element itself.
 * A drag that starts inside the panel (selecting text) and ends outside produces a click on the dialog too; that must not close it.
 */
export const isBackdropClose = (down: EventTarget | null, click: EventTarget | null, dialog: EventTarget): boolean =>
  down === dialog && click === dialog
