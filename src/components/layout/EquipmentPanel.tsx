import { EquipmentCard } from '@/components/equipment/EquipmentCard'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ARMOR_SLOTS, type ArmorSlot } from '@/data/types'
import { decosOf, findArmor, findDeco } from '@/state/build'
import type { useBuild } from '@/state/useBuild'
import { Section, displayHeading } from './Section'

const LABEL: Record<ArmorSlot, string> = { head: 'Head', chest: 'Chest', arms: 'Arms', waist: 'Waist', legs: 'Legs' }
const noop = () => {}

export function EquipmentPanel({
  b,
  onPick,
  onAddDeco,
}: {
  b: ReturnType<typeof useBuild>
  onPick: (slot: ArmorSlot) => void
  onAddDeco: (slot: ArmorSlot) => void
}) {
  const treeName = (id: number | string) => b.treeNames.get(Number(id)) ?? `#${id}`
  const empty = { armor: null, decos: [], capacity: 0, treeName, disabled: true, onChange: noop, onRemove: noop, onAddDeco: noop, onRemoveDeco: noop }
  return (
    <Section
      title="Equipment"
      aside={
        <span className="font-mono text-xs text-muted-foreground" title="Decorations placed / decoration slots of what is equipped">
          Slots used {b.totals.used} / {b.totals.capacity}
        </span>
      }
    >
      <Card className="mb-3 gap-3 py-4">
        <div className="space-y-3 px-4">
          <h3 className={displayHeading}>Start a set</h3>
          <p className="text-sm text-muted-foreground">
            Pick a weapon to set your class (Blademaster or Gunner) and its slots, or jump straight to armor. Skills
            fill in as you go.
          </p>
          <Button disabled>Choose a weapon</Button>
        </div>
      </Card>
      <ul className="space-y-2">
        <EquipmentCard label="Weapon" slot="weapon" {...empty} />
        {ARMOR_SLOTS.map((slot) => {
          const sel = b.build.armor[slot]
          const armor = sel ? findArmor(b.ctx, sel.armorId) : null
          const target = { kind: 'armor', slot } as const
          return (
            <EquipmentCard
              key={slot}
              label={LABEL[slot]}
              slot={slot}
              armor={armor}
              decos={decosOf(b.build, target).flatMap((id) => findDeco(b.ctx, id) ?? [])}
              capacity={armor?.slots ?? 0}
              treeName={treeName}
              onChange={() => onPick(slot)}
              onRemove={() => b.removeArmor(slot)}
              onAddDeco={() => onAddDeco(slot)}
              onRemoveDeco={(i) => b.removeDeco(target, i)}
            />
          )
        })}
        <EquipmentCard label="Charm" slot="charm" {...empty} />
      </ul>
    </Section>
  )
}
