import { useState } from 'react'
import { Section } from './Section'
import { Segmented } from './Segmented'

const RESISTANCES = ['Fire', 'Water', 'Thun.', 'Ice', 'Dragon'] as const
const DEFENSE_MODES = [
  { value: 'normal', label: 'Normal' },
  { value: 'max', label: 'Max' },
] as const

function DefenseSection() {
  const [mode, setMode] = useState<'normal' | 'max'>('normal')
  return (
    <Section title="Defense">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="font-mono text-3xl font-bold" aria-label="Defense value, none yet">
          -
        </span>
        <Segmented value={mode} onChange={setMode} options={DEFENSE_MODES} label="Defense mode" />
      </div>
      <dl className="grid grid-cols-5 gap-1.5 text-center">
        {RESISTANCES.map((r) => (
          <div key={r} className="rounded-md border bg-card px-1 py-2">
            <dt className="text-xs text-muted-foreground">{r}</dt>
            <dd className="font-mono text-sm">-</dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}

export function StatsPanels() {
  return (
    <div className="space-y-4">
      <DefenseSection />
      <Section title="Damage">
        <p className="text-sm text-muted-foreground">Equip a weapon to see effective raw and element.</p>
      </Section>
      <Section title="Materials and monsters">
        <p className="text-sm text-muted-foreground">Materials for your armor will be listed here.</p>
      </Section>
    </div>
  )
}
