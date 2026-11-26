import { useMemo } from 'react'
import { defenseView } from '@/lib/defenseView'
import { efeSummary, efrSummary } from '@/lib/damageView'
import { skillRows, summarizeSkills, summaryChips } from '@/lib/skillBar'
import { cn } from '@/lib/utils'
import type { DamageState } from '@/state/useDamageControls'
import type { useBuild } from '@/state/useBuild'

const CHIP = {
  active: 'border-deco-total/60 text-deco-total',
  near: 'border-skill-positive/60 text-skill-positive',
  penalty: 'border-skill-negative/60 text-skill-negative',
} as const

/** Equipment tab on small screens only: defense, slots, EFR and EFE, active skills and the skills that matter. Chips are inert for now. */
export function MobileSummary({ b, dmg }: { b: ReturnType<typeof useBuild>; dmg: DamageState }) {
  const rows = useMemo(() => skillRows(b.derived.skills, b.ctx.data.skills), [b.derived.skills, b.ctx.data.skills])
  const chips = summaryChips(rows)
  const d = defenseView(b.derived, b.build.armorLevel)
  const stat = (label: string, value: string) => (
    <div className="rounded-lg border bg-card px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono text-lg font-semibold">{value}</div>
    </div>
  )
  return (
    <div className="mb-3 space-y-2 lg:hidden">
      <div className="grid grid-cols-3 gap-2">
        {stat('Defense', d.hasAnything ? String(d.total) : '-')}
        {stat('Slots', `${b.totals.used}/${b.totals.capacity}`)}
        {stat('Active', String(summarizeSkills(rows).active))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {stat('EFR', efrSummary(dmg.result))}
        {stat('EFE', efeSummary(dmg.result))}
      </div>
      {chips.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Skills that matter">
          {chips.map((c) => (
            <li key={c.key} className={cn('rounded-full border px-2 py-0.5 text-xs', CHIP[c.kind])}>
              {c.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
