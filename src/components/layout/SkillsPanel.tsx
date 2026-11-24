import { useMemo } from 'react'
import { SkillRow } from '@/components/skills/SkillRow'
import { skillRows, summarizeSkills } from '@/lib/skillBar'
import type { useBuild } from '@/state/useBuild'
import { Section } from './Section'

function Legend() {
  const item = (cls: string, label: string) => (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={`inline-block h-2 w-4 rounded-sm ${cls}`} />
      {label}
    </span>
  )
  return (
    <p className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      {item('sk-base', 'Armor + charm')}
      {item('sk-deco', 'Decorations')}
      {item('sk-torso', 'Torso Up')}
    </p>
  )
}

export function SkillsPanel({ b }: { b: ReturnType<typeof useBuild> }) {
  const rows = useMemo(() => skillRows(b.derived.skills, b.ctx.data.skills), [b.derived.skills, b.ctx.data.skills])
  const { active, near } = summarizeSkills(rows)
  return (
    <Section
      title="Skills"
      aside={rows.length > 0 ? <span className="font-mono text-xs text-muted-foreground">{active} active · {near} near</span> : undefined}
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No skill points yet. Equip something to see them here.</p>
      ) : (
        <>
          <Legend />
          <ul className="space-y-2">
            {rows.map((v) => (
              <SkillRow key={v.treeId} view={v} />
            ))}
          </ul>
        </>
      )}
    </Section>
  )
}
