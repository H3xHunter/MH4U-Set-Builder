import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { Section } from '@/components/layout/Section'
import { Button } from '@/components/ui/button'
import type { BuffSource } from '@/lib/buffRegistry'
import { cn } from '@/lib/utils'
import type { DamageState } from '@/state/useDamageControls'

const SOURCE_TITLE: Record<BuffSource, string> = { skill: 'Skills', item: 'Items', song: 'Songs', kinsect: 'Kinsect' }

/** One area of the Buffs card ("Attack" now; a "Defense" section can sit next to it later). */
function BuffSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Bullet({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      className={cn(
        'flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        on ? 'bg-primary/10' : 'text-muted-foreground hover:bg-accent',
      )}
    >
      <span
        aria-hidden="true"
        className={cn('flex size-4 shrink-0 items-center justify-center rounded border', on ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground')}
      >
        {on && <Check className="size-3" />}
      </span>
      {label}
    </button>
  )
}

export function BuffsCard({ dmg }: { dmg: DamageState }) {
  return (
    <Section
      title="Buffs"
      aside={
        dmg.weapon && (
          <Button type="button" variant="outline" size="xs" onClick={dmg.reset}>
            Reset buffs
          </Button>
        )
      }
    >
      {!dmg.weapon ? (
        <p className="text-sm text-muted-foreground">Equip a weapon to see buffs.</p>
      ) : (
        <BuffSection title="Attack">
          {dmg.groups.map((g) => (
            <div key={g.source}>
              <h4 className="mb-1 text-xs font-semibold">{SOURCE_TITLE[g.source]}</h4>
              {g.source === 'song' && <p className="mb-1 text-xs text-muted-foreground">Songs are not yet limited to the horn&apos;s notes.</p>}
              <ul className="space-y-1">
                {g.buffs.map((buff) => (
                  <li key={buff.id}>
                    <Bullet
                      label={buff.condition ? `${buff.label}: ${buff.condition}` : buff.label}
                      on={dmg.toggles[buff.id] ?? buff.default}
                      onChange={(on) => dmg.setToggle(buff.id, on)}
                    />
                  </li>
                ))}
              </ul>
              {g.source === 'kinsect' && (
                <p className="mt-1 text-xs text-muted-foreground">{dmg.kinsect ? `${dmg.kinsect.label} +${dmg.kinsect.percent}% raw` : 'No combination active'}</p>
              )}
            </div>
          ))}
        </BuffSection>
      )}
    </Section>
  )
}
