import { X } from 'lucide-react'
import { GameIcon } from '@/components/GameIcon'
import { Button } from '@/components/ui/button'
import type { Armor, ArmorSlot, Decoration } from '@/data/types'
import { rarityTextColor, signed } from '@/lib/rarity'
import { displayHeading } from '@/components/layout/Section'
import { cn } from '@/lib/utils'
import { JewelCircles, RarityBadge, SkillChip, type TreeName } from './parts'

interface Props {
  label: string
  /** Used for the stable focus-return target of the pickers (data-trigger). */
  slot: ArmorSlot | 'weapon' | 'charm'
  armor: Armor | null
  decos: Decoration[]
  capacity: number
  treeName: TreeName
  disabled?: boolean
  onChange: () => void
  onRemove: () => void
  onAddDeco: () => void
  onRemoveDeco: (index: number) => void
}

/** 64px icon box below md uses a 32px one; the outline is drawn outside the box so the pixel art never rescales. */
function IconBox({ armor, slot }: { armor: Armor | null; slot: Props['slot'] }) {
  const box = 'shrink-0 rounded-sm outline outline-1 outline-border'
  if (!armor || slot === 'weapon' || slot === 'charm') {
    return <span aria-hidden="true" className={cn(box, 'size-8 border border-dashed bg-background md:size-16')} />
  }
  return (
    <>
      <span className={cn(box, 'md:hidden')}>
        <GameIcon kind="armor" slot={armor.slot} rarity={armor.rarity} scale={0.5} />
      </span>
      <span className={cn(box, 'hidden md:block')}>
        <GameIcon kind="armor" slot={armor.slot} rarity={armor.rarity} />
      </span>
    </>
  )
}

function DecoRow({ decos, capacity, label, treeName, onAddDeco, onRemoveDeco }: Pick<Props, 'decos' | 'capacity' | 'label' | 'treeName' | 'onAddDeco' | 'onRemoveDeco'>) {
  const used = decos.reduce((n, d) => n + d.size, 0)
  const free = Math.max(0, capacity - used)
  if (capacity === 0) return <p className="text-xs text-muted-foreground">No decoration slots</p>
  return (
    <div className="flex flex-wrap items-center gap-2">
      {decos.map((d, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-2 rounded-md border border-deco-total bg-background py-0.5 pr-1 pl-2 text-xs"
        >
          <JewelCircles size={d.size} color={d.color} />
          <span>{d.name}</span>
          <span className="font-mono text-muted-foreground">
            {Object.entries(d.skills)
              .map(([id, p]) => `${signed(p)} ${treeName(id)}`)
              .join(', ')}
          </span>
          <button
            type="button"
            aria-label={`Remove ${d.name}`}
            className="rounded p-0.5 text-muted-foreground hover:bg-row-hover hover:text-foreground"
            onClick={() => onRemoveDeco(i)}
          >
            <X aria-hidden className="size-3.5" />
          </button>
        </span>
      ))}
      {Array.from({ length: free }, (_, i) => (
        <button
          key={`free-${i}`}
          type="button"
          aria-label={`Add decoration to ${label}`}
          className="inline-flex items-center rounded-md border border-dashed border-slot-free px-2 py-1 hover:bg-row-hover"
          onClick={onAddDeco}
        >
          <span aria-hidden="true" className="size-3.5 rounded-full border-2 border-slot-free" />
        </button>
      ))}
    </div>
  )
}

export function EquipmentCard(p: Props) {
  const { armor } = p
  return (
    <li className="flex min-h-[88px] items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-row-hover">
      <IconBox armor={armor} slot={p.slot} />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn(displayHeading, 'order-1 shrink-0 text-muted-foreground')}>{p.label}</span>
          {/* Below md the name gets its own line so it is not truncated next to the buttons. */}
          <div className="order-3 flex min-w-0 basis-full items-center gap-2 md:order-2 md:basis-auto">
            {armor ? (
              <>
                <span className="min-w-0 truncate font-medium" style={{ color: rarityTextColor(armor.rarity) }}>
                  {armor.name}
                </span>
                <RarityBadge rarity={armor.rarity} />
                <span className="font-mono text-xs text-muted-foreground">Def {armor.defense}</span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">Empty</span>
            )}
          </div>
          <div className="order-2 ml-auto flex shrink-0 items-center gap-1 md:order-3">
            <Button variant="outline" size="sm" disabled={p.disabled} data-trigger={p.slot} onClick={p.onChange}>
              {armor ? 'Change' : 'Choose'}
            </Button>
            {armor && (
              <Button variant="ghost" size="icon-sm" aria-label={`Remove ${armor.name}`} onClick={p.onRemove}>
                <X aria-hidden />
              </Button>
            )}
          </div>
        </div>
        {armor && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(armor.skills).map(([id, pts]) => (
                <SkillChip key={id} name={p.treeName(id)} points={pts} />
              ))}
            </div>
            <DecoRow {...p} />
          </>
        )}
      </div>
    </li>
  )
}
