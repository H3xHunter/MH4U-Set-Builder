import { useMemo, useState } from 'react'
import { Section } from '@/components/layout/Section'
import { Segmented } from '@/components/layout/Segmented'
import { buildMaterials, effectiveMode, sortRows, totalIn, weaponsById, type MaterialIssue, type Route, type WeaponMode } from '@/lib/materials'
import type { useBuild } from '@/state/useBuild'
import { MaterialRow } from './MaterialRow'
import { MaterialSources } from './MaterialSources'
import { PieceRecipes, ROUTE_LABEL, type Lookup } from './PieceRecipes'

type Build = ReturnType<typeof useBuild>

const ROUTE_OPTIONS = [
  { value: 'create', label: ROUTE_LABEL.create },
  { value: 'improve', label: ROUTE_LABEL.improve },
] as const

/** User-facing wording; ids and internals never reach the screen. */
function issueText(i: MaterialIssue): string {
  switch (i.kind) {
    case 'noParent':
      return 'This weapon has no parent weapon in the data, so the path ends here.'
    case 'noRecipe':
      return 'A weapon on the path has no recipe in the data.'
    case 'missingWeapon':
      return 'A required weapon is missing from the data, so the path ends here.'
    case 'cycle':
      return 'The upgrade chain loops back on itself, so the path stops there.'
    case 'depthCap':
      return 'The upgrade chain is very long, so the path stops there.'
    case 'unknownItem':
      return 'A material in a recipe is missing from the data.'
    case 'unknownWeapon':
    case 'unknownArmor':
      return 'Something equipped is missing from the data.'
    default:
      return 'Some recipe information could not be used.'
  }
}

function useLookup(b: Build) {
  const data = b.ctx.data
  return useMemo(() => {
    const names = new Map<number, string>()
    for (const x of data.items) names.set(x.id, x.name)
    const materials = new Map(data.materials.map((x) => [x.id, x]))
    for (const x of data.materials) names.set(x.id, x.name)
    const armor = new Map(data.armor.map((a) => [a.id, a]))
    const weapons = weaponsById(data)
    const lookup: Lookup = {
      itemName: (id) => names.get(id) ?? `Item #${id}`,
      weapon: (id) => weapons.get(id),
      armor: (id) => armor.get(id),
    }
    return { lookup, materials }
  }, [data])
}

export function MaterialsPanel({ b }: { b: Build }) {
  const data = b.ctx.data
  const { lookup, materials } = useLookup(b)
  // Session-only UI state: never saved, never part of the build.
  const [mode, setMode] = useState<WeaponMode>('step')
  const [pickedRoute, setPickedRoute] = useState<{ weaponId: number; route: Route } | null>(null)
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set())

  const sel = b.build.weapon
  const weaponId = sel.kind === 'data' ? sel.weaponId : null
  // A route chosen for another weapon is ignored, so the route resets when the equipped weapon changes.
  const route = pickedRoute && pickedRoute.weaponId === weaponId ? pickedRoute.route : undefined
  const m = useMemo(() => buildMaterials(b.build, data, { weaponMode: mode, route }), [b.build, data, mode, route])

  const steps = m.weaponPathSteps
  // The stored choice is kept; only what is shown and counted follows the effective mode.
  const effMode = effectiveMode(mode, steps.length)
  const hasWeaponRecipe = m.weaponStep.availableRoutes.length > 0
  const rows = useMemo(() => sortRows(m.rows.values(), effMode), [m.rows, effMode])
  const notes = [...new Set(m.issues.map(issueText))]

  const toggle = (id: number) =>
    setOpen((s) => {
      const next = new Set(s)
      if (!next.delete(id)) next.add(id)
      return next
    })

  const pathLabel = steps.length > 0 ? `Full path (${steps.length} ${steps.length === 1 ? 'step' : 'steps'})` : 'Full path'
  const modeOptions = [
    { value: 'step' as WeaponMode, label: 'This step' },
    { value: 'path' as WeaponMode, label: pathLabel, disabled: steps.length === 0, title: steps.length === 0 ? 'No earlier steps' : undefined },
  ]
  const equipped = m.perArmorPiece.length > 0 || hasWeaponRecipe

  return (
    <Section title="Materials">
      {hasWeaponRecipe && (
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          {m.weaponStep.availableRoutes.length === 2 && weaponId !== null && (
            <Segmented
              value={m.weaponStep.route ?? 'create'}
              onChange={(r) => setPickedRoute({ weaponId, route: r })}
              options={ROUTE_OPTIONS}
              label="Weapon route"
            />
          )}
          <Segmented value={effMode} onChange={setMode} options={modeOptions} label="Weapon materials" />
          {steps.length === 0 && <span className="text-xs text-muted-foreground">no earlier steps</span>}
        </div>
      )}

      {!equipped ? (
        <p className="text-sm text-muted-foreground">Equip armor or a weapon to see its materials.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing equipped has a recipe in the data.</p>
      ) : (
        <ul aria-label="Materials needed">
          {rows.map((r) => {
            const material = materials.get(r.itemId)
            const base = r.armor + r.weaponStep
            const path = totalIn(r, effMode) - base
            return (
              <MaterialRow
                key={r.itemId}
                name={r.name}
                rarity={material?.rarity}
                base={base}
                path={path}
                open={open.has(r.itemId)}
                onToggle={() => toggle(r.itemId)}
              >
                {material ? (
                  <MaterialSources material={material} data={data} />
                ) : (
                  <p className="text-sm text-muted-foreground">No source in the data.</p>
                )}
              </MaterialRow>
            )
          })}
        </ul>
      )}

      <PieceRecipes m={m} mode={effMode} lookup={lookup} />

      {notes.length > 0 && (
        <ul className="mt-3 space-y-0.5">
          {notes.map((t) => (
            <li key={t} className="text-xs text-muted-foreground">
              {t}
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
