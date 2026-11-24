import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { displayHeading } from '@/components/layout/Section'
import { isBackdropClose } from '@/lib/backdrop'
import { cn } from '@/lib/utils'

/**
 * Controlled native modal. Use this instead of Radix Dialog/AlertDialog/Select/DropdownMenu: those mount
 * react-remove-scroll, which injects a <style> tag at runtime and violates our CSP.
 * Children are mounted only while open. The browser returns focus to the opener on close, and
 * focuses the first `[data-autofocus]` element on open (React's autoFocus runs before showModal and is lost).
 * If the opener was removed while the modal was open, focus goes to the first match of `fallbackFocus` instead.
 */
export function Modal({
  open,
  onClose,
  onEscape,
  title,
  description,
  fallbackFocus,
  closeOnBackdrop = true,
  children,
  className,
}: {
  open: boolean
  onClose: () => void
  /** If given, Esc calls this instead of onClose (e.g. to step back inside a picker). */
  onEscape?: () => void
  title: ReactNode
  description?: string
  /** CSS selector for where focus lands when the opener no longer exists on close. */
  fallbackFocus?: string
  /** False while closing would lose work (an unsaved draft): a backdrop click then does nothing. */
  closeOnBackdrop?: boolean
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const opener = useRef<Element | null>(null)
  const id = useId()
  const pressed = useRef<EventTarget | null>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      opener.current = document.activeElement
      d.showModal()
      d.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    } else if (!open && d.open) {
      d.close()
      if (fallbackFocus && !opener.current?.isConnected) document.querySelector<HTMLElement>(fallbackFocus)?.focus()
    }
  }, [open, fallbackFocus])

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-desc` : undefined}
      // With onEscape, handle the key itself: the native `cancel` event is only cancelable after a user
      // activation, so without this a second Esc (or one before any click) would close the dialog regardless.
      onKeyDown={(e) => {
        if (e.key === 'Escape' && onEscape) {
          e.preventDefault()
          onEscape()
        }
      }}
      // Esc otherwise: take over the native close so React state stays the single source of truth.
      onCancel={(e) => {
        e.preventDefault()
        ;(onEscape ?? onClose)()
      }}
      onClose={onClose}
      // A backdrop click is a press and a click that both landed on the dialog element itself (see isBackdropClose).
      onPointerDown={(e) => (pressed.current = e.target)}
      onClick={(e) => {
        const backdrop = isBackdropClose(pressed.current, e.target, e.currentTarget)
        pressed.current = null
        if (backdrop && closeOnBackdrop) onClose()
      }}
    >
      {open && (
        <div className={cn('modal-panel', className)}>
          <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
            <h2 id={`${id}-title`} className={cn(displayHeading, 'leading-normal')}>
              {title}
            </h2>
            <button
              type="button"
              aria-label="Close"
              className="rounded p-1 text-muted-foreground hover:bg-row-hover hover:text-foreground"
              onClick={onClose}
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
          {description && (
            <p id={`${id}-desc`} className="sr-only">
              {description}
            </p>
          )}
          {children}
        </div>
      )}
    </dialog>
  )
}
