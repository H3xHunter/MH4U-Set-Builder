import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DecorationPicker, type DecoTarget } from '@/components/pickers/DecorationPicker'
import { ArmorPicker } from '@/components/pickers/ArmorPicker'
import { WeaponPicker } from '@/components/pickers/WeaponPicker'
import type { ArmorSlot, GameData } from '@/data/types'
import { hunterTypeOfClass } from '@/lib/weaponClass'
import { capacityOf, decosOf, findArmor, findDeco, resolveWeapon, type Target } from '@/state/build'
import { useBuild } from '@/state/useBuild'
import { EquipmentPanel } from './EquipmentPanel'
import { Rise } from './Rise'
import { PLAY_STYLES, Segmented, type PlayStyle } from './Segmented'
import { SkillsPanel } from './SkillsPanel'
import { StatsPanels } from './StatsPanels'

// Mobile shows one tab at a time; from lg up every tab is shown as a column.
type CardKey = ArmorSlot | 'weapon'
const targetOf = (key: CardKey): Target => (key === 'weapon' ? { kind: 'weapon' } : { kind: 'armor', slot: key })

const tabContent = 'min-w-0 data-[state=inactive]:hidden lg:data-[state=inactive]:block'

export function Builder({ data, style, onStyle }: { data: GameData; style: PlayStyle; onStyle: (s: PlayStyle) => void }) {
  const b = useBuild(data)
  const [armorPick, setArmorPick] = useState<{ slot: ArmorSlot; open: boolean } | null>(null)
  const [decoPick, setDecoPick] = useState<{ key: CardKey; target: DecoTarget; open: boolean } | null>(null)
  // `session` is the React key: every open mounts a fresh picker that starts from the current weapon.
  const [weaponPick, setWeaponPick] = useState({ open: false, session: 0 })
  const treeName = (id: number | string) => b.treeNames.get(Number(id)) ?? `#${id}`

  const openDecoPicker = (key: CardKey) => {
    const target = targetOf(key)
    const capacity = capacityOf(b.build, target, b.ctx)
    const used = decosOf(b.build, target).reduce((n, id) => n + (findDeco(b.ctx, id)?.size ?? 0), 0)
    const name =
      key === 'weapon'
        ? (resolveWeapon(b.build, b.ctx)?.name ?? 'Custom weapon')
        : (findArmor(b.ctx, b.build.armor[key]?.armorId ?? -1)?.name ?? '')
    setDecoPick({ key, open: true, target: { name, used, capacity } })
  }
  const closeArmor = () => setArmorPick((p) => p && { ...p, open: false })
  const closeWeapon = () => setWeaponPick((p) => ({ ...p, open: false }))
  const closeDeco = () => setDecoPick((p) => p && { ...p, open: false })

  return (
    <>
      <div className="mb-3 lg:hidden">
        <Segmented value={style} onChange={onStyle} options={PLAY_STYLES} label="Hunter class" />
      </div>
      <Tabs defaultValue="equipment" className="gap-3">
        <TabsList className="w-full lg:hidden" aria-label="Panels">
          <TabsTrigger value="equipment">Equipment</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
        </TabsList>
        <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)_300px] lg:items-start lg:gap-4">
          {/* hidden={false}: Radix sets the hidden attribute on inactive panels, which would beat lg:block. */}
          <TabsContent value="skills" forceMount hidden={false} tabIndex={-1} className={`${tabContent} lg:order-1`}>
            <Rise delay={0}>
              <SkillsPanel b={b} />
            </Rise>
          </TabsContent>
          <TabsContent value="equipment" forceMount hidden={false} tabIndex={-1} className={`${tabContent} lg:order-2`}>
            <Rise delay={50}>
              <EquipmentPanel
                b={b}
                onPick={(slot) => setArmorPick({ slot, open: true })}
                onAddDeco={openDecoPicker}
                onPickWeapon={() => setWeaponPick((p) => ({ open: true, session: p.session + 1 }))}
              />
            </Rise>
          </TabsContent>
          <TabsContent value="stats" forceMount hidden={false} tabIndex={-1} className={`${tabContent} lg:order-3`}>
            <Rise delay={100}>
              <StatsPanels b={b} />
            </Rise>
          </TabsContent>
        </div>
      </Tabs>
      <ArmorPicker
        pick={armorPick}
        onClose={closeArmor}
        data={data}
        initialClass={style}
        treeName={treeName}
        onPick={b.equipArmor}
      />
      <DecorationPicker
        pick={decoPick}
        returnTo={decoPick?.key}
        onClose={closeDeco}
        data={data}
        fits={(id) => !!decoPick && b.canAddDeco(targetOf(decoPick.key), id)}
        treeName={treeName}
        onPick={(id) => decoPick && b.addDeco(targetOf(decoPick.key), id)}
      />
      <WeaponPicker
        key={weaponPick.session}
        open={weaponPick.open}
        onClose={closeWeapon}
        data={data}
        hunter={style}
        current={b.build.weapon}
        onPickWeapon={(w) => {
          b.dispatch({ type: 'setWeapon', weapon: { kind: 'data', weaponId: w.id } })
          const type = hunterTypeOfClass(w.class)
          if (type) onStyle(type)
          closeWeapon()
        }}
        onPickCustom={(slots) => {
          b.dispatch({ type: 'setWeapon', weapon: { kind: 'slots', slots } })
          closeWeapon()
        }}
      />
    </>
  )
}
