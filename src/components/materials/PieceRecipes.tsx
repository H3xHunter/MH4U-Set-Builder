import { useState, type ReactNode } from 'react'
import type { Armor, Weapon } from '@/data/types'
import type { BuildMaterials, PathStep, RecipeLine, Route, WeaponMode } from '@/lib/materials'
import { rarityTextColor } from '@/lib/rarity'

export const ROUTE_LABEL: Record<Route, string> = { create: 'Create', improve: 'Upgrade' }
const SLOT_LABEL = { head: 'Head', chest: 'Chest', arms: 'Arms', waist: 'Waist', legs: 'Legs' } as const

export interface Lookup {
  itemName: (id: number) => string
  weapon: (id: number) => Weapon | undefined
  armor: (id: number) => Armor | undefined
}

function Disclosure({ label, children, nested }: { label: string; children: ReactNode; nested?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={nested ? 'mt-2' : undefined}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-baseline gap-1.5 rounded-md py-1 text-left text-sm font-medium hover:underline"
      >
        <span aria-hidden="true" className="w-3 font-mono text-xs text-muted-foreground">
          {open ? '▾' : '▸'}
        </span>
        {label}
      </button>
      {open && <div className="ml-4 border-l pl-3">{children}</div>}
    </div>
  )
}

function Lines({ lines, lookup }: { lines: RecipeLine[]; lookup: Lookup }) {
  return (
    <ul className="space-y-0.5 text-sm">
      {lines.map((l) => (
        <li key={l.itemId}>
          <span className="mr-1 font-mono tabular-nums">{l.quantity}×</span>
          {lookup.itemName(l.itemId)}
        </li>
      ))}
    </ul>
  )
}

function Requires({ id, lookup }: { id: number | null; lookup: Lookup }) {
  if (id === null) return null
  const w = lookup.weapon(id)
  return <p className="text-xs text-muted-foreground">Requires {w?.name ?? 'another weapon'}</p>
}

function WeaponName({ w, fallback }: { w: Weapon | undefined; fallback: string }) {
  return (
    <span className="font-medium" style={{ color: w ? rarityTextColor(w.rarity) : undefined }}>
      {w?.name ?? fallback}
    </span>
  )
}

function StepItem({ s, lookup }: { s: PathStep; lookup: Lookup }) {
  return (
    <li className="mb-2">
      <div className="text-sm">
        <WeaponName w={lookup.weapon(s.weaponId)} fallback={s.name} />
        <span className="ml-2 text-xs text-muted-foreground">{ROUTE_LABEL[s.kind]}</span>
      </div>
      <Requires id={s.requiresWeaponId} lookup={lookup} />
      <Lines lines={s.lines} lookup={lookup} />
    </li>
  )
}

/** Per equipped piece recipes, the weapon step, and the upgrade path (every list closed by default). */
export function PieceRecipes({ m, mode, lookup }: { m: BuildMaterials; mode: WeaponMode; lookup: Lookup }) {
  const weapon = m.weaponStep.weaponId === null ? undefined : lookup.weapon(m.weaponStep.weaponId)
  const hasWeaponStep = weapon !== undefined && m.weaponStep.route !== null
  if (m.perArmorPiece.length === 0 && !hasWeaponStep) return null
  return (
    <div className="mt-4 border-t pt-2">
      <Disclosure label="By piece">
        <ul className="space-y-3 py-1">
          {m.perArmorPiece.map((p) => (
            <li key={p.slot}>
              <div className="text-sm">
                <span className="mr-2 text-[11px] uppercase tracking-wider text-muted-foreground">{SLOT_LABEL[p.slot]}</span>
                <span className="font-medium" style={{ color: rarityTextColor(lookup.armor(p.armorId)?.rarity ?? 0) }}>
                  {p.name}
                </span>
              </div>
              {p.lines === null ? (
                <p className="text-sm text-muted-foreground">No recipe in the data</p>
              ) : (
                <Lines lines={p.lines} lookup={lookup} />
              )}
            </li>
          ))}
          {hasWeaponStep && m.weaponStep.route !== null && (
            <li>
              <div className="text-sm">
                <span className="mr-2 text-[11px] uppercase tracking-wider text-muted-foreground">Weapon</span>
                <WeaponName w={weapon} fallback="Weapon" />
                <span className="ml-2 text-xs text-muted-foreground">{ROUTE_LABEL[m.weaponStep.route]}</span>
              </div>
              <Requires id={m.weaponStep.requiresWeaponId} lookup={lookup} />
              <Lines lines={m.weaponStep.lines} lookup={lookup} />
              {m.weaponPathSteps.length > 0 && (
                <Disclosure nested label={`Upgrade path (${m.weaponPathSteps.length} ${m.weaponPathSteps.length === 1 ? 'step' : 'steps'})`}>
                  <p className="mb-1.5 text-xs text-muted-foreground">
                    {mode === 'path'
                      ? 'Counted in the totals above. Earliest step first.'
                      : 'Not counted in the totals above; switch to Full path to include it. Earliest step first.'}
                  </p>
                  <ol className="py-1">
                    {m.weaponPathSteps.map((s) => (
                      <StepItem key={s.weaponId} s={s} lookup={lookup} />
                    ))}
                  </ol>
                </Disclosure>
              )}
            </li>
          )}
        </ul>
      </Disclosure>
    </div>
  )
}
