import { X } from 'lucide-react'
import { GameIcon } from '@/components/GameIcon'
import { displayHeading } from '@/components/layout/Section'
import { Button } from '@/components/ui/button'
import type { Decoration, SavedCharm } from '@/data/types'
import { charmLabel, charmSkillEntries, charmSummary } from '@/lib/charmView'
import { cn } from '@/lib/utils'
import { DecoRow } from './EquipmentCard'
import { SkillChip, SlotRings, type TreeName } from './parts'

const box = 'shrink-0 rounded-sm outline outline-1 outline-border'

interface Props {
  charm: SavedCharm
  decos: Decoration[]
  capacity: number
  treeName: TreeName
  onChange: () => void
  onRemove: () => void
  onAddDeco: () => void
  onRemoveDeco: (index: number) => void
}

export function CharmCard({ charm, ...p }: Props) {
  const label = charmLabel(charm, p.treeName)
  return (
    <li className="flex min-h-[88px] items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-row-hover">
      <span className={cn(box, 'md:hidden')}>
        <GameIcon kind="charm" scale={0.5} />
      </span>
      <span className={cn(box, 'hidden md:block')}>
        <GameIcon kind="charm" />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn(displayHeading, 'order-1 shrink-0 text-muted-foreground')}>Charm</span>
          <div className="order-3 flex min-w-0 basis-full items-center gap-2 md:order-2 md:basis-auto">
            <span className="min-w-0 truncate font-medium">{label}</span>
            <SlotRings count={charm.slots} />
          </div>
          <div className="order-2 ml-auto flex shrink-0 items-center gap-1 md:order-3">
            <Button variant="outline" size="sm" data-trigger="charm" onClick={p.onChange}>
              Change
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Remove ${label}`} onClick={p.onRemove}>
              <X aria-hidden />
            </Button>
          </div>
        </div>
        {charm.name && <p className="text-xs text-muted-foreground">{charmSummary(charm, p.treeName)}</p>}
        <div className="flex flex-wrap gap-1.5">
          {charmSkillEntries(charm).map(([id, pts]) => (
            <SkillChip key={id} name={p.treeName(id)} points={pts} />
          ))}
        </div>
        <DecoRow label="Charm" decos={p.decos} capacity={p.capacity} treeName={p.treeName} onAddDeco={p.onAddDeco} onRemoveDeco={p.onRemoveDeco} />
      </div>
    </li>
  )
}
