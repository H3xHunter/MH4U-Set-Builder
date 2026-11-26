import { Section } from '@/components/layout/Section'
import { classMultiplier } from '@/lib/damage'
import { SHARPNESS_ELEMENT, SHARPNESS_RAW } from '@/lib/damageTables'
import { formatDecimal, formatFactor, formatSignedDecimal, instanceLabel, SHARPNESS_NAMES } from '@/lib/damageView'
import { cn } from '@/lib/utils'
import { isDoubleAffinity } from '@/lib/weaponFormat'
import type { DamageState } from '@/state/useDamageControls'

// Static class names so Tailwind finds them; colors come from the tokens in index.css (no style prop: the CSP blocks it).
const ELEMENT_DOT: Record<string, string> = {
  Fire: 'bg-[var(--element-fire)]',
  Water: 'bg-[var(--element-water)]',
  Thunder: 'bg-[var(--element-thunder)]',
  Ice: 'bg-[var(--element-ice)]',
  Dragon: 'bg-[var(--element-dragon)]',
}
const SWATCH = [
  'bg-[var(--sharp-red)]',
  'bg-[var(--sharp-orange)]',
  'bg-[var(--sharp-yellow)]',
  'bg-[var(--sharp-green)]',
  'bg-[var(--sharp-blue)]',
  'bg-[var(--sharp-white)]',
  'bg-[var(--sharp-purple)]',
] as const

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-mono text-sm">{children}</dd>
    </div>
  )
}
const inGame = (text: string) => <span className="ml-1.5 text-xs text-muted-foreground">({text} in game)</span>

export function DamageCard({ dmg }: { dmg: DamageState }) {
  const { weapon, result } = dmg
  if (!weapon || !result) {
    return (
      <Section title="Damage">
        <p className="text-sm text-muted-foreground">Equip a weapon to see effective raw and element.</p>
      </Section>
    )
  }
  const mult = classMultiplier(weapon.class) ?? 1

  if (!result.ok) {
    return (
      <Section title="Damage">
        <p className="text-sm" role="status">
          {result.reason}
        </p>
        {result.trueRaw !== null && (
          <dl className="mt-3 border-t pt-2">
            <Row label="True raw (weapon)">
              {formatDecimal(result.trueRaw)}
              {inGame(String(weapon.attack))}
            </Row>
          </dl>
        )}
      </Section>
    )
  }

  const hasStatus = result.instances.some((i) => i.kind === 'status')
  return (
    <Section title="Damage">
      <div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Effective raw (EFR)</p>
        <p>
          <span className="font-mono text-4xl font-bold" data-slot="efr">
            {formatDecimal(result.efrTrue)}
          </span>
          <span className="ml-2 font-mono text-sm text-muted-foreground">({formatDecimal(result.efrDisplayed)} in game)</span>
        </p>
      </div>

      {(result.instances.length > 0 || result.awakenLocked) && (
        <ul className="mt-3 space-y-1 border-t pt-3" aria-label="Effective element and status">
          {result.instances.map((i) => (
            <li key={i.slot} className="flex items-baseline justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm">
                <span aria-hidden="true" className={cn('size-2 rounded-full', ELEMENT_DOT[i.type] ?? 'bg-muted-foreground')} />
                {instanceLabel(i)}
              </span>
              <span className="font-mono text-lg font-semibold">{formatDecimal(i.effectiveShown)}</span>
            </li>
          ))}
          {hasStatus && <li className="text-xs text-muted-foreground">Higher value means faster buildup, not more damage.</li>}
          {result.awakenLocked && <li className="text-xs text-muted-foreground">Awaken element inactive: needs the Awaken skill</li>}
        </ul>
      )}

      <dl className="mt-3 border-t pt-2">
        <Row label="True raw (weapon)">
          {formatDecimal(result.trueRaw)}
          {inGame(String(weapon.attack))}
        </Row>
        <Row label="Raw after buffs">
          {formatDecimal(result.rawAfterBuffs)}
          {inGame(formatDecimal(result.rawAfterBuffs * mult))}
        </Row>
        <Row label="Affinity">
          {formatSignedDecimal(result.affinity)}%
          {isDoubleAffinity(weapon) && <span className="ml-1.5 text-xs text-muted-foreground">average of two values</span>}
        </Row>
        <Row label="Crit factor">×{formatFactor(result.critFactor)}</Row>
        <Row label="Sharpness">
          {SHARPNESS_NAMES[result.sharpness.selected]}
          <span className="ml-1.5 text-xs text-muted-foreground">
            raw ×{formatFactor(SHARPNESS_RAW[result.sharpness.selected])} · element ×{formatFactor(SHARPNESS_ELEMENT[result.sharpness.selected])}
          </span>
        </Row>
      </dl>

      <div role="group" aria-labelledby="sharp-label" className="mt-3 border-t pt-3">
        <p id="sharp-label" className="mb-1.5 text-xs text-muted-foreground">
          Sharpness (simulate wear or a higher level)
        </p>
        <div className="flex flex-wrap gap-1.5">
          {result.sharpness.selectable.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={c === result.sharpness.selected}
              onClick={() => dmg.chooseColor(c)}
              className={cn(
                'flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
                c === result.sharpness.selected ? 'border-primary bg-primary/15 font-semibold' : 'text-muted-foreground hover:bg-accent',
              )}
            >
              <span aria-hidden="true" className={cn('size-2.5 rounded-sm border border-black/30', SWATCH[c])} />
              {SHARPNESS_NAMES[c]}
            </button>
          ))}
        </div>
      </div>

      {result.weaknessExploit && (
        <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
          Weakness Exploit: +5 to hitzones of 45 or more. The gain depends on the monster part: meaningful on average hitzones, smaller on very weak
          spots. Not included in EFR.
        </p>
      )}
    </Section>
  )
}
