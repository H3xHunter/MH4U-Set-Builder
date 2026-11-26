import { ChevronDown, ChevronRight } from 'lucide-react'
import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react'
import { GameIcon } from '@/components/GameIcon'
import { RarityBadge } from '@/components/equipment/parts'
import { displayHeading } from '@/components/layout/Section'
import type { PlayStyle } from '@/components/layout/Segmented'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/Modal'
import type { GameData, Weapon } from '@/data/types'
import { trueRaw } from '@/lib/damage'
import { rarityTextColor } from '@/lib/rarity'
import { cn } from '@/lib/utils'
import { BLADEMASTER_CLASSES, GUNNER_CLASSES, hunterTypeOfClass, type WeaponClass, WEAPON_CLASSES } from '@/lib/weaponClass'
import { elementColor, elementParts, formatAffinity, isDoubleAffinity } from '@/lib/weaponFormat'
import {
  ancestorIds,
  buildWeaponTree,
  collapsibleIds,
  flatTree,
  hasFinalForms,
  visibleRows,
  type VisibleRow,
} from '@/lib/weaponTree'
import type { WeaponSelection } from '@/state/build'
import { keyHint } from './pickerStyles'

const DOUBLE_TITLE = 'Two possible values. Damage uses their average.'
const COLS = 'md:grid md:grid-cols-[minmax(0,1fr)_56px_56px_120px_150px_64px] md:items-center md:gap-3'
const knownClass = (c: string): c is WeaponClass => (WEAPON_CLASSES as readonly string[]).includes(c)
const hunterName = (h: PlayStyle) => (h === 'blade' ? 'Blademaster' : 'Gunner')

function ClassIcon({ weaponClass }: { weaponClass: string }) {
  return (
    <span aria-hidden="true" className="inline-flex shrink-0 rounded-sm outline outline-1 outline-border">
      <span className="md:hidden">
        <GameIcon kind="weapon" weaponClass={weaponClass} scale={0.5} />
      </span>
      <span className="hidden md:block">
        <GameIcon kind="weapon" weaponClass={weaponClass} />
      </span>
    </span>
  )
}

function SlotCircles({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${count} ${count === 1 ? 'slot' : 'slots'}`}>
      {Array.from({ length: 3 }, (_, i) => (
        <span key={i} className={cn('size-2.5 rounded-full border-2', i < count ? 'border-slot-free' : 'border-border/50')} />
      ))}
    </span>
  )
}

function ClassStep({
  hunter,
  counts,
  onClass,
  onCustom,
}: {
  hunter: PlayStyle
  counts: Map<string, number>
  onClass: (c: WeaponClass) => void
  onCustom: (slots: 0 | 1 | 2 | 3) => void
}) {
  const group = (title: string, classes: readonly WeaponClass[]) => (
    <section className="space-y-2">
      <h3 className={cn(displayHeading, 'text-muted-foreground')}>
        {title} <span className="font-mono text-xs">{classes.length} classes</span>
      </h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {classes.map((c) => (
          <button
            key={c}
            type="button"
            className="flex items-center gap-3 rounded-lg border bg-card p-2 text-left hover:bg-row-hover"
            onClick={() => onClass(c)}
          >
            <ClassIcon weaponClass={c} />
            <span className="min-w-0">
              <span className="block truncate font-medium">{c}</span>
              <span className="font-mono text-xs text-muted-foreground">{counts.get(c) ?? 0} weapons</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
      <p className="text-sm text-muted-foreground">
        Your toggle is on {hunterName(hunter)}. Picking a weapon switches it to that weapon&apos;s class type, and the armor
        pool follows.
      </p>
      {group('Blademaster', BLADEMASTER_CLASSES)}
      {group('Gunner', GUNNER_CLASSES)}
      <section className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-3">
        <span className="text-sm">Custom weapon (slots only)</span>
        <span className="ml-auto flex gap-1">
          {([0, 1, 2, 3] as const).map((n) => (
            <Button key={n} variant="outline" size="sm" aria-label={`Custom weapon with ${n} ${n === 1 ? 'slot' : 'slots'}`} onClick={() => onCustom(n)}>
              {n}
            </Button>
          ))}
        </span>
      </section>
    </div>
  )
}

export function WeaponRow({
  row,
  id,
  active,
  foldable,
  onPick,
  onToggle,
}: {
  row: VisibleRow
  id: string
  active: boolean
  foldable: boolean
  onPick: (w: Weapon) => void
  onToggle: (id: number) => void
}) {
  const w = row.weapon
  const double = isDoubleAffinity(w)
  const elements = elementParts(w)
  const trueValue = trueRaw(w) // attack / class multiplier, an exact integer in the data; null for an unknown class
  return (
    <li
      id={id}
      role="treeitem"
      aria-level={row.depth + 1}
      aria-expanded={row.hasChildren && foldable ? row.expanded : undefined}
      aria-selected={active}
      className={cn('cursor-pointer border-b px-4 py-2', active ? 'bg-row-hover' : 'hover:bg-row-hover/60', row.context && 'opacity-50')}
      onClick={() => onPick(w)}
    >
      <div className={COLS}>
        <div className="flex min-w-0 items-center gap-2" style={{ paddingLeft: row.depth * 16 }}>
          {row.hasChildren && foldable ? (
            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-row-hover"
              onClick={(e) => {
                e.stopPropagation()
                onToggle(w.id)
              }}
            >
              {row.expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
          ) : (
            <span className="size-5 shrink-0" />
          )}
          <span className="min-w-0 truncate font-medium" style={{ color: rarityTextColor(w.rarity) }}>
            {w.name}
          </span>
          <RarityBadge rarity={w.rarity} />
          {w.final && <span className="rounded border border-primary/50 px-1 text-[10px] leading-4 text-primary">FINAL</span>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-7 text-xs md:contents md:pl-0">
          <span>
            <span className="text-muted-foreground md:hidden">Atk </span>
            <span className="font-mono md:text-sm">{w.attack}</span>
          </span>
          <span>
            <span className="text-muted-foreground md:hidden">True </span>
            <span className="font-mono md:text-sm">{trueValue === null ? '-' : trueValue}</span>
          </span>
          <span title={double ? DOUBLE_TITLE : undefined}>
            <span className="text-muted-foreground md:hidden">Aff </span>
            <span className="font-mono md:text-sm">{formatAffinity(w)}</span>
          </span>
          <span className="flex flex-wrap gap-x-2">
            {elements.length === 0 ? (
              <span className="text-muted-foreground">-</span>
            ) : (
              elements.map((e) => (
                <span key={e.kind} className={cn('inline-flex items-center gap-1', e.kind !== 'element' && 'text-muted-foreground')}>
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-current" style={{ backgroundColor: elementColor(e.type) }} />
                  {e.label}
                </span>
              ))
            )}
          </span>
          <SlotCircles count={w.slots} />
        </div>
      </div>
    </li>
  )
}

/** Column titles of the weapon list; hidden below md, where each row labels its own stats. */
export function WeaponHeader() {
  return (
    <div className={cn(COLS, 'hidden border-y px-4 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground')}>
      <span className="pl-7">Name</span>
      <span>Attack</span>
      <span>True</span>
      <span>Affinity</span>
      <span>Element</span>
      <span>Slots</span>
    </div>
  )
}

function ClassList({
  cls,
  weapons,
  allById,
  equippedId,
  hunter,
  onBack,
  onPick,
}: {
  cls: WeaponClass
  weapons: Weapon[]
  allById: ReadonlyMap<number, Weapon>
  equippedId: number | null
  hunter: PlayStyle
  onBack: () => void
  onPick: (w: Weapon) => void
}) {
  const base = useId()
  const optionId = (id: number) => `${base}-w${id}`
  const tree = useMemo(() => {
    const t = buildWeaponTree(weapons, allById)
    return t.hasCycle ? flatTree(weapons, t.issues) : t
  }, [weapons, allById])
  const broken = tree.issues.some((i) => i.kind === 'cycle')
  const hasFinal = useMemo(() => hasFinalForms(weapons), [weapons])

  const [query, setQuery] = useState('')
  const [finalOnly, setFinalOnly] = useState(false)
  // Starts folded to the roots, except the path to the equipped weapon.
  const [collapsed, setCollapsed] = useState<Set<number>>(() => {
    const s = collapsibleIds(tree)
    if (equippedId !== null) for (const a of ancestorIds(tree, equippedId)) s.delete(a)
    return s
  })
  const [activeId, setActiveId] = useState<number | null>(equippedId)

  const rows = useMemo(() => visibleRows(tree, { collapsed, query, finalOnly: finalOnly && hasFinal }), [tree, collapsed, query, finalOnly, hasFinal])
  const foldable = query.trim() === '' && !(finalOnly && hasFinal)
  const found = rows.findIndex((r) => r.weapon.id === activeId)
  const active = found >= 0 ? found : rows.length > 0 ? 0 : -1
  const activeWeapon = active >= 0 ? rows[active].weapon : null
  const activeKey = activeWeapon?.id

  // Not in the dialog yet on first mount (children mount before Modal calls showModal), hence the timeout.
  useEffect(() => {
    if (activeKey === undefined) return
    const t = setTimeout(() => document.getElementById(`${base}-w${activeKey}`)?.scrollIntoView({ block: 'nearest' }), 0)
    return () => clearTimeout(t)
  }, [activeKey, base])

  const toggle = (id: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const go = (j: number) => {
      e.preventDefault()
      const r = rows[Math.max(0, Math.min(rows.length - 1, j))]
      if (r) setActiveId(r.weapon.id)
    }
    const row = active >= 0 ? rows[active] : null
    const el = e.currentTarget
    const atStart = el.selectionStart === 0 && el.selectionEnd === 0
    const atEnd = el.selectionStart === el.value.length && el.selectionEnd === el.value.length
    if (e.key === 'ArrowDown') go(active + 1)
    else if (e.key === 'ArrowUp') go(active - 1)
    else if (e.key === 'Home') go(0)
    else if (e.key === 'End') go(rows.length - 1)
    else if (e.key === 'Enter' && row) {
      e.preventDefault()
      onPick(row.weapon)
    } else if (e.key === 'ArrowRight' && row && atEnd) {
      e.preventDefault()
      if (row.hasChildren && foldable) {
        if (!row.expanded) toggle(row.weapon.id)
        else go(active + 1)
      }
    } else if (e.key === 'ArrowLeft' && row && atStart) {
      e.preventDefault()
      if (row.hasChildren && foldable && row.expanded) toggle(row.weapon.id)
      else if (row.parentId !== null) {
        const p = rows.findIndex((r) => r.weapon.id === row.parentId)
        if (p >= 0) go(p)
      }
    }
  }

  const q = query.trim()
  const type = hunterTypeOfClass(cls)
  return (
    <>
      <div className="space-y-3 border-b p-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack}>
            All classes
          </Button>
          <ClassIcon weaponClass={cls} />
          <span className="font-medium">{cls}</span>
          <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">{type === 'gunner' ? 'Gunner' : 'Blademaster'}</span>
          {type !== null && type !== hunter && <span className="text-xs text-muted-foreground">Picking switches your toggle.</span>}
        </div>
        <Input
          type="text"
          data-autofocus
          autoFocus // when stepping in from the tiles the dialog is already open; data-autofocus covers a fresh open
          placeholder="Search weapons by name"
          aria-label="Search weapons by name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded
          aria-haspopup="tree"
          aria-controls={`${base}-tree`}
          aria-activedescendant={activeKey !== undefined ? optionId(activeKey) : undefined}
          aria-autocomplete="list"
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className={cn('flex items-center gap-2 text-sm', !hasFinal && 'text-muted-foreground')}>
            <input
              type="checkbox"
              role="switch"
              className="size-4 accent-primary"
              checked={finalOnly && hasFinal}
              disabled={!hasFinal}
              aria-describedby={hasFinal ? undefined : `${base}-nofinal`}
              onChange={(e) => setFinalOnly(e.target.checked)}
            />
            Final forms only
          </label>
          {!hasFinal && (
            <span id={`${base}-nofinal`} className="text-xs text-muted-foreground">
              No final-form data for this class
            </span>
          )}
          {foldable && !broken && (
            <span className="ml-auto flex gap-1">
              <Button variant="outline" size="sm" onClick={() => setCollapsed(new Set())}>
                Expand all
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCollapsed(collapsibleIds(tree))}>
                Collapse all
              </Button>
            </span>
          )}
        </div>
        {broken && (
          <p role="alert" className="rounded-md border border-destructive/50 px-3 py-2 text-sm text-destructive">
            Upgrade tree data is missing. Showing a flat list, sorted by rarity.
          </p>
        )}
      </div>
      <p className="px-4 py-2 text-xs text-muted-foreground" aria-live="polite">
        {q !== ''
          ? `${rows.filter((r) => !r.context).length} matches for '${q}'`
          : `${rows.length} ${rows.length === 1 ? 'weapon' : 'weapons'}`}
      </p>
      <WeaponHeader />
      <ul id={`${base}-tree`} role="tree" aria-label={`${cls} weapons`} className="min-h-0 flex-1 overflow-y-auto border-t md:border-t-0">
        {rows.map((r, i) => (
          <WeaponRow key={r.weapon.id} row={r} id={optionId(r.weapon.id)} active={i === active} foldable={foldable} onPick={onPick} onToggle={toggle} />
        ))}
      </ul>
      <p className={cn(keyHint, 'hidden min-h-9 md:block')} aria-live="polite">
        {activeWeapon ? <span className="font-medium text-foreground">{activeWeapon.name}</span> : null}
        {activeWeapon ? ' · ' : ''}Up/Down move, Left/Right fold, Enter equip, Esc back
      </p>
    </>
  )
}

/** Mount a fresh instance (new `key`) for every open: the starting step and fold state come from `current`. */
export function WeaponPicker({
  open,
  onClose,
  data,
  hunter,
  current,
  onPickWeapon,
  onPickCustom,
}: {
  open: boolean
  onClose: () => void
  data: GameData
  hunter: PlayStyle
  current: WeaponSelection
  onPickWeapon: (weapon: Weapon) => void
  onPickCustom: (slots: 0 | 1 | 2 | 3) => void
}) {
  const { byClass, byId } = useMemo(() => {
    const byClass = new Map<string, Weapon[]>()
    for (const w of data.weapons) byClass.set(w.class, [...(byClass.get(w.class) ?? []), w])
    return { byClass, byId: new Map(data.weapons.map((w) => [w.id, w])) }
  }, [data])
  const counts = useMemo(() => new Map([...byClass].map(([c, ws]) => [c, ws.length])), [byClass])

  const equipped = current.kind === 'data' ? (byId.get(current.weaponId) ?? null) : null
  const [cls, setCls] = useState<WeaponClass | null>(equipped && knownClass(equipped.class) ? equipped.class : null)

  return (
    <Modal
      open={open}
      onClose={onClose}
      onEscape={cls ? () => setCls(null) : undefined}
      fallbackFocus='[data-trigger="weapon"]'
      title="Choose a weapon"
      description="Pick a weapon class, then a weapon. Escape goes back one step."
      className="[--modal-max:48rem]"
    >
      {cls === null ? (
        <ClassStep hunter={hunter} counts={counts} onClass={setCls} onCustom={onPickCustom} />
      ) : (
        <ClassList
          key={cls}
          cls={cls}
          weapons={byClass.get(cls) ?? []}
          allById={byId}
          equippedId={equipped && equipped.class === cls ? equipped.id : null}
          hunter={hunter}
          onBack={() => setCls(null)}
          onPick={onPickWeapon}
        />
      )}
    </Modal>
  )
}
