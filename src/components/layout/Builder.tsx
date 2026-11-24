import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DecorationPicker, type DecoTarget } from '@/components/pickers/DecorationPicker'
import { ArmorPicker } from '@/components/pickers/ArmorPicker'
import type { ArmorSlot, GameData } from '@/data/types'
import { decosOf, findArmor, findDeco } from '@/state/build'
import { useBuild } from '@/state/useBuild'
import { EquipmentPanel } from './EquipmentPanel'
import { Rise } from './Rise'
import { PLAY_STYLES, Segmented, type PlayStyle } from './Segmented'
import { SkillsPanel } from './SkillsPanel'
import { StatsPanels } from './StatsPanels'

// Mobile shows one tab at a time; from lg up every tab is shown as a column.
const tabContent = 'min-w-0 data-[state=inactive]:hidden lg:data-[state=inactive]:block'

export function Builder({ data, style, onStyle }: { data: GameData; style: PlayStyle; onStyle: (s: PlayStyle) => void }) {
  const b = useBuild(data)
  const [armorPick, setArmorPick] = useState<{ slot: ArmorSlot; open: boolean } | null>(null)
  const [decoPick, setDecoPick] = useState<{ target: DecoTarget; slot: ArmorSlot; open: boolean } | null>(null)
  const treeName = (id: number | string) => b.treeNames.get(Number(id)) ?? `#${id}`

  const openDecoPicker = (slot: ArmorSlot) => {
    const sel = b.build.armor[slot]
    const armor = sel && findArmor(b.ctx, sel.armorId)
    if (!armor) return
    const used = decosOf(b.build, { kind: 'armor', slot }).reduce((n, id) => n + (findDeco(b.ctx, id)?.size ?? 0), 0)
    setDecoPick({ slot, open: true, target: { name: armor.name, used, capacity: armor.slots, returnTo: slot } })
  }
  const closeArmor = () => setArmorPick((p) => p && { ...p, open: false })
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
              <SkillsPanel />
            </Rise>
          </TabsContent>
          <TabsContent value="equipment" forceMount hidden={false} tabIndex={-1} className={`${tabContent} lg:order-2`}>
            <Rise delay={50}>
              <EquipmentPanel
                b={b}
                onPick={(slot) => setArmorPick({ slot, open: true })}
                onAddDeco={openDecoPicker}
              />
            </Rise>
          </TabsContent>
          <TabsContent value="stats" forceMount hidden={false} tabIndex={-1} className={`${tabContent} lg:order-3`}>
            <Rise delay={100}>
              <StatsPanels />
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
        onClose={closeDeco}
        data={data}
        fits={(id) => !!decoPick && b.canAddDeco({ kind: 'armor', slot: decoPick.slot }, id)}
        treeName={treeName}
        onPick={(id) => decoPick && b.addDeco({ kind: 'armor', slot: decoPick.slot }, id)}
      />
    </>
  )
}
