import { memo, useMemo, useState } from 'react'
import { RarityBadge, SkillChip, SlotRings, type TreeName } from '@/components/equipment/parts'
import { Segmented, type PlayStyle } from '@/components/layout/Segmented'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/Modal'
import type { Armor, ArmorSlot, GameData } from '@/data/types'
import { filterArmor, type ClassFilter } from '@/lib/armorFilter'
import { rarityTextColor } from '@/lib/rarity'
import { cn } from '@/lib/utils'
import { keyHint, selectClass } from './pickerStyles'
import { useListbox } from './useListbox'

const CLASS_OPTIONS = [
  { value: 'blade', label: 'Blademaster' },
  { value: 'gunner', label: 'Gunner' },
  { value: 'all', label: 'All' },
] as const
const SLOT_OPTIONS = [
  { value: '0', label: 'Any' },
  { value: '1', label: '1+' },
  { value: '2', label: '2+' },
  { value: '3', label: '3+' },
] as const
const CLASS_TAG: Record<string, string> = { blade: 'Blademaster', gunner: 'Gunner', both: 'Both' }

const ArmorRow = memo(function ArmorRow({
  armor,
  id,
  active,
  treeName,
  onChoose,
}: {
  armor: Armor
  id: string
  active: boolean
  treeName: TreeName
  onChoose: (armorId: number) => void
}) {
  return (
    <li
      id={id}
      role="option"
      aria-selected={active}
      className={cn('cursor-pointer space-y-1.5 border-b px-4 py-2', active ? 'bg-row-hover' : 'hover:bg-row-hover/60')}
      onClick={() => onChoose(armor.id)}
    >
      <div className="flex items-center gap-2">
        <span className="min-w-0 truncate font-medium" style={{ color: rarityTextColor(armor.rarity) }}>
          {armor.name}
        </span>
        <RarityBadge rarity={armor.rarity} />
        <span className="rounded border px-1 text-[11px] leading-4 text-muted-foreground">
          {armor.hunterType === null ? 'Unknown class' : CLASS_TAG[armor.hunterType]}
        </span>
        <SlotRings count={armor.slots} />
        <span className="ml-auto font-mono text-xs text-muted-foreground">Def {armor.defense}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(armor.skills).map(([sid, pts]) => (
          <SkillChip key={sid} name={treeName(sid)} points={pts} />
        ))}
      </div>
    </li>
  )
})

function Body({
  slot,
  data,
  initialClass,
  treeName,
  onPick,
}: {
  slot: ArmorSlot
  data: GameData
  initialClass: PlayStyle
  treeName: TreeName
  onPick: (armorId: number) => void
}) {
  const [query, setQuery] = useState('')
  const [cls, setCls] = useState<ClassFilter>(initialClass)
  const [skillId, setSkillId] = useState<number | null>(null)
  const [minSlots, setMinSlots] = useState<0 | 1 | 2 | 3>(0)

  const results = useMemo(
    () => filterArmor(data.armor, data.skills, { slot, query, cls, skillId, minSlots }),
    [data, slot, query, cls, skillId, minSlots],
  )
  // Only trees that some piece of this slot has positive points in, so no option is a dead end.
  const skillOptions = useMemo(() => {
    const ids = new Set<string>()
    for (const a of data.armor) if (a.slot === slot) for (const [k, v] of Object.entries(a.skills)) if (v > 0) ids.add(k)
    return data.skills.filter((t) => ids.has(String(t.id))).sort((a, b) => (a.name < b.name ? -1 : 1))
  }, [data, slot])

  const lb = useListbox(results.length, (i) => onPick(results[i].id))
  const change = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    lb.reset()
  }

  return (
    <>
      <div className="space-y-3 border-b p-4">
        <Input
          type="text"
          data-autofocus
          placeholder="Search by piece or skill"
          aria-label="Search by piece name or skill"
          value={query}
          onChange={(e) => change(setQuery)(e.target.value)}
          onKeyDown={lb.onKeyDown}
          {...lb.comboProps}
        />
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <div className="space-y-1">
            <Segmented value={cls} onChange={change(setCls)} options={CLASS_OPTIONS} label="Class" />
            <p className="text-xs text-muted-foreground">Class starts from your header toggle</p>
          </div>
          <label className="min-w-40 flex-1 space-y-1 text-xs text-muted-foreground">
            Has skill
            <select
              className={selectClass}
              value={skillId ?? ''}
              onChange={(e) => change(setSkillId)(e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">Any skill</option>
              {skillOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Deco slots</span>
            <Segmented
              value={String(minSlots) as '0' | '1' | '2' | '3'}
              onChange={(v) => change(setMinSlots)(Number(v) as 0 | 1 | 2 | 3)}
              options={SLOT_OPTIONS}
              label="Minimum decoration slots"
            />
          </div>
        </div>
      </div>
      <p className="px-4 py-2 text-xs text-muted-foreground" aria-live="polite">
        {results.length} {results.length === 1 ? 'result' : 'results'}
      </p>
      <ul id={lb.listboxId} role="listbox" aria-label="Armor" className="min-h-0 flex-1 overflow-y-auto border-t">
        {results.map((a, i) => (
          <ArmorRow key={a.id} armor={a} id={lb.optionId(i)} active={i === lb.active} treeName={treeName} onChoose={onPick} />
        ))}
      </ul>
      <p className={keyHint}>Up/Down move, Enter equip, Esc close</p>
    </>
  )
}

/** `pick` keeps its slot while `open` is false, so the content stays during the closing animation. */
export function ArmorPicker({
  pick,
  onClose,
  ...rest
}: {
  pick: { slot: ArmorSlot; open: boolean } | null
  onClose: () => void
  data: GameData
  initialClass: PlayStyle
  treeName: TreeName
  onPick: (slot: ArmorSlot, armorId: number) => void
}) {
  const slot = pick?.slot
  return (
    <Modal
      open={pick?.open ?? false}
      onClose={onClose}
      description="Search and filter, then choose with the keyboard or mouse."
      title={
        <>
          <span className="uppercase">{slot} slot</span>, Choose armor
        </>
      }
    >
      {slot && (
        <Body
          slot={slot}
          data={rest.data}
          initialClass={rest.initialClass}
          treeName={rest.treeName}
          onPick={(id) => {
            rest.onPick(slot, id)
            onClose()
          }}
        />
      )}
    </Modal>
  )
}
