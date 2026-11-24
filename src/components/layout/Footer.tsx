import { FAN_DISCLAIMER } from '@/lib/legal'

// z-10: above page content, below dialogs and popovers (z-50 in the shadcn components).
export function Footer() {
  return (
    <footer className="sticky bottom-0 z-10 border-t bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <p className="mx-auto max-w-[1440px] text-center text-[11px] text-muted-foreground md:text-xs">
        {FAN_DISCLAIMER}
      </p>
    </footer>
  )
}
