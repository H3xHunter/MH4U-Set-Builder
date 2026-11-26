import { Sword, X } from 'lucide-react'
import { GameIcon } from '@/components/GameIcon'
import { displayHeading } from '@/components/layout/Section'
import { Button } from '@/components/ui/button'
import type { Decoration, Weapon } from '@/data/types'
import { rarityTextColor } from '@/lib/rarity'
import { elementColor, elementParts, formatAffinity, isDoubleAffinity } from '@/lib/weaponFormat'
import { cn } from '@/lib/utils'
import { DecoRow } from './EquipmentCard'
import { RarityBadge, type TreeName } from './parts'

interface Props {
  /** A weapon from the data, or null for the slots-only custom weapon. */
  weapon: Weapon | null
  customSlots: number
  decos: Decoration[]
  capacity: number
  treeName: TreeName
  onChange: () => void
  onRemove: () => void
  onAddDeco: () => void
  onRemoveDeco: (index: number) => void
}

const box = 'shrink-0 rounded-sm outline outline-1 outline-border'

export function WeaponCard({ weapon, customSlots, ...p }: Props) {
  return (
    <li className="flex min-h-[88px] items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-row-hover">
      {weapon ? (
        <>
          <span className={cn(box, 'md:hidden')}>
            <GameIcon kind="weapon" weaponClass={weapon.class} rarity={weapon.rarity} scale={0.5} />
          </span>
          <span className={cn(box, 'hidden md:block')}>
            <GameIcon kind="weapon" weaponClass={weapon.class} rarity={weapon.rarity} />
          </span>
        </>
      ) : (
        <span aria-hidden="true" className={cn(box, 'flex size-8 items-center justify-center bg-background text-muted-foreground md:size-16')}>
          <Sword className="size-4 md:size-8" />
        </span>
      )}
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn(displayHeading, 'order-1 shrink-0 text-muted-foreground')}>Weapon</span>
          <div className="order-3 flex min-w-0 basis-full items-center gap-2 md:order-2 md:basis-auto">
            {weapon ? (
              <>
                <span className="min-w-0 truncate font-medium" style={{ color: rarityTextColor(weapon.rarity) }}>
                  {weapon.name}
                </span>
                <RarityBadge rarity={weapon.rarity} />
              </>
            ) : (
              <>
                <span className="font-medium">Custom weapon</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {customSlots} {customSlots === 1 ? 'slot' : 'slots'}
                </span>
              </>
            )}
          </div>
          <div className="order-2 ml-auto flex shrink-0 items-center gap-1 md:order-3">
            <Button variant="outline" size="sm" data-trigger="weapon" onClick={p.onChange}>
              Change
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Remove ${weapon ? weapon.name : 'custom weapon'}`} onClick={p.onRemove}>
              <X aria-hidden />
            </Button>
          </div>
        </div>
        {weapon && (
          <>
            <p className="text-sm text-muted-foreground">
              {weapon.class} · Atk <span className="font-mono text-foreground">{weapon.attack}</span> · Aff{' '}
              <span className="font-mono text-foreground">{formatAffinity(weapon)}</span>
            </p>
            {isDoubleAffinity(weapon) && (
              <p className="text-xs text-muted-foreground">Two possible values; damage uses their average.</p>
            )}
            {elementParts(weapon).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {elementParts(weapon).map((e) => (
                  <span
                    key={e.kind}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs',
                      e.kind !== 'element' && 'text-muted-foreground',
                    )}
                  >
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-current" style={{ backgroundColor: elementColor(e.type) }} />
                    {e.label}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
        <DecoRow label="Weapon" decos={p.decos} capacity={p.capacity} treeName={p.treeName} onAddDeco={p.onAddDeco} onRemoveDeco={p.onRemoveDeco} />
      </div>
    </li>
  )
}
