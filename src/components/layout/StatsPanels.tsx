import { FORMULA_TEXT, breakdownParts, defenseView, formatPercent, formatSigned } from '@/lib/defenseView'
import { cn } from '@/lib/utils'
import type { useBuild } from '@/state/useBuild'
import { Section } from './Section'
import { Segmented } from './Segmented'

type Build = ReturnType<typeof useBuild>

const LEVELS = [
  { value: 'normal', label: 'Normal' },
  { value: 'max', label: 'Max' },
] as const
const CAPTION = { normal: 'Armor at normal level', max: 'Armor at max upgrade level' } as const

function DefenseSection({ b }: { b: Build }) {
  const level = b.build.armorLevel
  const v = defenseView(b.derived, level)
  return (
    <Section title="Defense">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="font-mono text-4xl font-bold">{v.hasAnything ? v.total : '-'}</span>
          <p className="text-xs text-muted-foreground">{CAPTION[level]}</p>
        </div>
        <Segmented value={level} onChange={(l) => b.dispatch({ type: 'setArmorLevel', level: l })} options={LEVELS} label="Armor level" />
      </div>

      {/* Damage reduction sits on its own row under the number: prominent, but smaller than the defense value. */}
      <div className="mt-3 flex items-baseline justify-between gap-2 border-t pt-3" title={FORMULA_TEXT}>
        <span className="text-sm text-muted-foreground">Damage reduction</span>
        <span className="font-mono text-xl font-semibold">
          {v.reduction !== null ? formatPercent(v.reduction) : '-'}
          {v.taken !== null && (
            <span className="ml-1.5 text-base font-normal text-[hsl(209_100%_88%)]">
              ({formatPercent(v.taken)}<span className="sr-only"> damage received</span>)
            </span>
          )}
        </span>
      </div>
      {v.hasAnything && (
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          {breakdownParts(v).join(' · ')}
        </p>
      )}
      {v.fallbackCount > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {v.fallbackCount === 1 ? '1 piece has' : `${v.fallbackCount} pieces have`} no max defense in the data;{' '}
          {v.fallbackCount === 1 ? 'its' : 'their'} normal defense is used.
        </p>
      )}

      <h3 className="mb-1.5 mt-4 text-[11px] uppercase tracking-wider text-muted-foreground" title="Armor plus element resistance skills">
        Resistances
      </h3>
      <div className="grid grid-cols-5 gap-1.5 text-center">
        {v.resist.map((r) => (
          <div
            key={r.key}
            role="group"
            aria-label={`${r.name} resistance ${v.hasAnything ? formatSigned(r.value) : 'none yet'}`}
            className="rounded-md border bg-card px-1 py-2"
          >
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <span aria-hidden="true" className="size-1.5 rounded-full" style={{ backgroundColor: `var(--element-${r.key})` }} />
              {r.label}
            </div>
            <div className={cn('font-mono text-sm', !v.hasAnything || r.value === 0 ? 'text-muted-foreground' : r.value < 0 && 'text-skill-negative')}>
              {v.hasAnything ? formatSigned(r.value) : '-'}
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

export function StatsPanels({ b }: { b: Build }) {
  return (
    <div className="space-y-4">
      <DefenseSection b={b} />
      <Section title="Damage">
        <p className="text-sm text-muted-foreground">Equip a weapon to see effective raw and element.</p>
      </Section>
      <Section title="Materials and monsters">
        <p className="text-sm text-muted-foreground">Materials for your armor will be listed here.</p>
      </Section>
    </div>
  )
}
