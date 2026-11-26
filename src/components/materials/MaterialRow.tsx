import { useId, type ReactNode } from 'react'
import { rarityTextColor } from '@/lib/rarity'

/** One total: a button that expands the source list (children are only rendered while open). */
export function MaterialRow({
  name,
  rarity,
  base,
  path,
  open,
  onToggle,
  children,
}: {
  name: string
  rarity: number | undefined
  /** Quantity from armor and the weapon step. */
  base: number
  /** Quantity from earlier weapon steps; shown only in full path mode. */
  path: number
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  const id = useId()
  const total = base + path
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        title={path > 0 ? `${total} in total: ${base} for armor and this step, ${path} from earlier steps` : undefined}
        aria-label={`${name}, ${total}${path > 0 ? ` (${path} from earlier steps)` : ''}`}
        className="flex w-full items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-left hover:bg-row-hover"
      >
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span aria-hidden="true" className="w-3 shrink-0 font-mono text-xs text-muted-foreground">
            {open ? '▾' : '▸'}
          </span>
          <span className="min-w-0 break-words" style={{ color: rarityTextColor(rarity ?? 0) }}>
            {name}
          </span>
        </span>
        <span aria-hidden="true" className="flex shrink-0 items-baseline justify-end gap-2 font-mono tabular-nums">
          {path > 0 && (
            <span className="text-xs text-muted-foreground">
              {base > 0 && `${base} + `}
              <span style={{ color: 'var(--material-path)' }}>
                {base === 0 && '+'}
                {path} path
              </span>
            </span>
          )}
          <span data-slot="material-total">{total}</span>
        </span>
      </button>
      {open && (
        <div id={id} className="mb-1 ml-5 border-l pl-3 pt-1 pb-2">
          {children}
        </div>
      )}
    </li>
  )
}
