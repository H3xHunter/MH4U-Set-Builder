import { EquipmentCard } from '@/components/equipment/EquipmentCard'
import { WeaponCard } from '@/components/equipment/WeaponCard'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ARMOR_SLOTS, type ArmorSlot } from '@/data/types'
import { capacityOf, decosOf, findArmor, findDeco, resolveWeapon } from '@/state/build'
import type { useBuild } from '@/state/useBuild'
import { MobileSummary } from './MobileSummary'
import { Section, displayHeading } from './Section'

const LABEL: Record<ArmorSlot, string> = { head: 'Head', chest: 'Chest', arms: 'Arms', waist: 'Waist', legs: 'Legs' }
const noop = () => {}

export function EquipmentPanel({
  b,
  onPick,
  onAddDeco,
  onPickWeapon,
}: {
  b: ReturnType<typeof useBuild>
  onPick: (slot: ArmorSlot) => void
  onAddDeco: (key: ArmorSlot | 'weapon') => void
  onPickWeapon: () => void
}) {
  const treeName = (id: number | string) => b.treeNames.get(Number(id)) ?? `#${id}`
  const charmEmpty = { armor: null, decos: [], capacity: 0, treeName, disabled: true, onChange: noop, onRemove: noop, onAddDeco: noop, onRemoveDeco: noop }
  const weaponTarget = { kind: 'weapon' } as const
  const weaponSel = b.build.weapon
  const weaponData = resolveWeapon(b.build, b.ctx)
  // The Start a set card is only for an empty build: it goes away once any weapon or armor is chosen.
  const empty = weaponSel.kind === 'none' && ARMOR_SLOTS.every((slot) => b.build.armor[slot] === null)
  return (
    <Section
      title="Equipment"
      aside={
        <span className="font-mono text-xs text-muted-foreground" title="Decorations placed / decoration slots of what is equipped">
          Slots used {b.totals.used} / {b.totals.capacity}
        </span>
      }
    >
      <MobileSummary b={b} />
      {empty && (
        <Card className="mb-3 gap-3 py-4">
          <div className="space-y-3 px-4">
            <h3 className={displayHeading}>Start a set</h3>
            <p className="text-sm text-muted-foreground">
              Pick a weapon to set your class (Blademaster or Gunner) and its slots, or jump straight to armor. Skills
              fill in as you go.
            </p>
            <Button onClick={onPickWeapon}>Choose a weapon</Button>
          </div>
        </Card>
      )}
      <ul className="space-y-2">
        {weaponSel.kind === 'none' ? (
          <EquipmentCard
            label="Weapon"
            slot="weapon"
            armor={null}
            decos={[]}
            capacity={0}
            treeName={treeName}
            onChange={onPickWeapon}
            onRemove={noop}
            onAddDeco={noop}
            onRemoveDeco={noop}
          />
        ) : (
          <WeaponCard
            weapon={weaponData}
            customSlots={weaponSel.kind === 'slots' ? weaponSel.slots : 0}
            decos={decosOf(b.build, weaponTarget).flatMap((id) => findDeco(b.ctx, id) ?? [])}
            capacity={capacityOf(b.build, weaponTarget, b.ctx)}
            treeName={treeName}
            onChange={onPickWeapon}
            onRemove={() => b.dispatch({ type: 'setWeapon', weapon: { kind: 'none' } })}
            onAddDeco={() => onAddDeco('weapon')}
            onRemoveDeco={(i) => b.removeDeco(weaponTarget, i)}
          />
        )}
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
        <EquipmentCard label="Charm" slot="charm" {...charmEmpty} />
      </ul>
    </Section>
  )
}
