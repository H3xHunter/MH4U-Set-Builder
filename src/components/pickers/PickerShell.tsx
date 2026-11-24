import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { displayHeading } from '@/components/layout/Section'
import { cn } from '@/lib/utils'

/** Full-height bottom sheet below md, centered max-w-2xl dialog from md. Focus returns to `[data-trigger=returnTo]`. */
export function PickerShell({
  open,
  onOpenChange,
  title,
  returnTo,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  returnTo: string
  children: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        onCloseAutoFocus={(e) => {
          e.preventDefault()
          document.querySelector<HTMLElement>(`[data-trigger="${returnTo}"]`)?.focus()
        }}
        className={cn(
          'flex flex-col gap-0 overflow-hidden border-border bg-surface p-0',
          'top-auto bottom-0 left-0 h-[92dvh] max-w-none translate-x-0 translate-y-0 rounded-t-xl rounded-b-none',
          'md:top-1/2 md:bottom-auto md:left-1/2 md:h-[min(720px,85dvh)] md:max-w-2xl md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl',
        )}
      >
        <DialogTitle className={cn(displayHeading, 'border-b px-4 py-3 pr-12 leading-normal')}>{title}</DialogTitle>
        <DialogDescription className="sr-only">Search and filter, then choose with the keyboard or mouse.</DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  )
}

export const selectClass = 'h-9 w-full min-w-0 rounded-md border border-input bg-card px-2 text-sm'
export const keyHint = 'border-t px-4 py-2 text-xs text-muted-foreground'
