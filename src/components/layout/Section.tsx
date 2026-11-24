import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const displayHeading = 'font-display text-[17px] font-semibold uppercase tracking-[0.08em]'

export function Section({
  title,
  aside,
  className,
  children,
}: {
  title: string
  aside?: ReactNode
  className?: string
  children: ReactNode
}) {
  const id = useId()
  return (
    <section aria-labelledby={id} className={cn('rounded-xl border bg-surface p-4', className)}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 id={id} className={displayHeading}>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  )
}
