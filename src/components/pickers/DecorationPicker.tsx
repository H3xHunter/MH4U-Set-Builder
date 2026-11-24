import { memo, useMemo, useState } from 'react'
import { DecoEffects, JewelCircles, type TreeName } from '@/components/equipment/parts'
import { Segmented } from '@/components/layout/Segmented'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/Modal'
import type { Decoration, GameData } from '@/data/types'
import { filterDecos } from '@/lib/decoFilter'
import { cn } from '@/lib/utils'
import { keyHint } from './pickerStyles'
import { useListbox } from './useListbox'

const SIZE_OPTIONS = [
  { value: '0', label: 'All' },
  { value: '1', label: 'Size 1' },
  { value: '2', label: 'Size 2' },
  { value: '3', label: 'Size 3' },
] as const

export interface DecoTarget {
  /** Piece name shown in the header. */
  name: string
  used: number
  capacity: number
}

const DecoRow = memo(function DecoRow({
  deco,
  id,
  active,
  fits,
  free,
  treeName,
  onChoose,
}: {
  deco: Decoration
  id: string
  active: boolean
  fits: boolean
  free: number
  treeName: TreeName
  onChoose: (decoId: number) => void
}) {
  return (
    <li
      id={id}
      role="option"
      aria-selected={active}
      aria-disabled={!fits}
      className={cn(
        'flex items-center gap-3 border-b px-4 py-2',
        fits ? 'cursor-pointer' : 'cursor-not-allowed opacity-60',
        active ? 'bg-row-hover' : fits && 'hover:bg-row-hover/60',
      )}
      onClick={() => fits && onChoose(deco.id)}
    >
      <JewelCircles size={deco.size} color={deco.color} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{deco.name}</span>
        <DecoEffects deco={deco} treeName={treeName} />
      </span>
      {fits ? (
        <span className="shrink-0 text-xs text-muted-foreground">Size {deco.size}</span>
      ) : (
        <span className="shrink-0 text-xs text-destructive">
          Needs {deco.size} slots, {free} free
        </span>
      )}
    </li>
  )
})

const sizesUpTo = (n: number) => Array.from({ length: n }, (_, i) => i + 1).join(' or ')

function Body({
  data,
  target,
  fits,
  treeName,
  onPick,
}: {
  data: GameData
  target: DecoTarget
  fits: (decoId: number) => boolean
  treeName: TreeName
  onPick: (decoId: number) => void
}) {
  const [query, setQuery] = useState('')
  const [size, setSize] = useState<0 | 1 | 2 | 3>(0)
  const [onlyFits, setOnlyFits] = useState(false)
  const free = Math.max(0, target.capacity - target.used)

  const results = useMemo(
    () => filterDecos(data.decorations, data.skills, { query, size, onlyFits }, (d) => fits(d.id)),
    [data, query, size, onlyFits, fits],
  )
  const lb = useListbox(results.length, (i) => fits(results[i].id) && onPick(results[i].id))
  const activeDeco = lb.active >= 0 ? results[lb.active] : undefined
  const blocked = activeDeco && !fits(activeDeco.id) ? activeDeco : undefined
  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    lb.reset()
  }

  return (
    <>
      <div className="space-y-3 border-b p-4">
        <p className="flex flex-wrap items-baseline gap-x-3 text-sm">
          <span className="font-medium">{target.name}</span>
          <span className="font-mono text-xs text-muted-foreground">
            {target.used}/{target.capacity} slots
          </span>
          <span className="font-mono text-xs text-slot-used">Free here {free}</span>
        </p>
        <Input
          type="text"
          data-autofocus
          placeholder="Search by decoration or skill"
          aria-label="Search by decoration name or skill"
          value={query}
          onChange={(e) => reset(setQuery)(e.target.value)}
          onKeyDown={lb.onKeyDown}
          {...lb.comboProps}
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <Segmented
            value={String(size) as '0' | '1' | '2' | '3'}
            onChange={(v) => reset(setSize)(Number(v) as 0 | 1 | 2 | 3)}
            options={SIZE_OPTIONS}
            label="Decoration size"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={onlyFits}
              onChange={(e) => reset(setOnlyFits)(e.target.checked)}
            />
            Only show what fits
          </label>
        </div>
      </div>
      <p className="px-4 py-2 text-xs text-muted-foreground" aria-live="polite">
        {results.length} {results.length === 1 ? 'result' : 'results'}
      </p>
      <ul id={lb.listboxId} role="listbox" aria-label="Decorations" className="min-h-0 flex-1 overflow-y-auto border-t">
        {results.map((d, i) => (
          <DecoRow
            key={d.id}
            deco={d}
            id={lb.optionId(i)}
            active={i === lb.active}
            fits={fits(d.id)}
            free={free}
            treeName={treeName}
            onChoose={onPick}
          />
        ))}
      </ul>
      <p className={cn(keyHint, 'min-h-9')} aria-live="polite">
        {blocked
          ? `${blocked.name} needs ${blocked.size} slots. This piece has ${free} free. ${
              free === 0 ? 'Free a slot first.' : `Free a slot or pick a size ${sizesUpTo(free)} decoration.`
            }`
          : 'Up/Down move, Enter add, Esc close'}
      </p>
    </>
  )
}

/** `pick` keeps its target while `open` is false, so the content stays during the closing animation. */
export function DecorationPicker({
  pick,
  returnTo,
  onClose,
  data,
  fits,
  treeName,
  onPick,
}: {
  pick: { target: DecoTarget; open: boolean } | null
  /** data-trigger of the card's Change button: focus goes there if the free-slot button that opened us is gone. */
  returnTo?: string
  onClose: () => void
  data: GameData
  fits: (decoId: number) => boolean
  treeName: TreeName
  onPick: (decoId: number) => void
}) {
  const target = pick?.target
  return (
    <Modal
      open={pick?.open ?? false}
      onClose={onClose}
      fallbackFocus={returnTo && `[data-trigger="${returnTo}"]`}
      description="Search and filter, then choose with the keyboard or mouse."
      title="Choose decoration"
    >
      {target && (
        <Body
          data={data}
          target={target}
          fits={fits}
          treeName={treeName}
          onPick={(id) => {
            onPick(id)
            onClose()
          }}
        />
      )}
    </Modal>
  )
}
