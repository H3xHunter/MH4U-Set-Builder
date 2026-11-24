import { formatPoints, skillAriaLabel, type SkillView } from '@/lib/skillBar'
import { cn } from '@/lib/utils'

export interface TickMotion {
  /** Threshold of the tick that was crossed (gain) or left (loss). */
  threshold: number | null
  kind: 'gain' | 'loss'
  /** Changes on every tier change so the CSS animation restarts. */
  n: number
}

const at = (pct: number) => ({ left: `${pct}%` })

export function SkillBar({ view, motion }: { view: SkillView; motion: TickMotion | null }) {
  const { bar } = view
  return (
    <div role="img" aria-label={skillAriaLabel(view)} className="px-2">
      <div className="relative">
        <div className="sk-track">
          {bar.segments.map((s) => (
            <span key={s.kind} className={cn('sk-seg', `sk-${s.kind}`)} style={{ left: `${s.fromPct}%`, width: `${s.toPct - s.fromPct}%` }} />
          ))}
          {bar.rail && <span className="sk-rail" style={{ left: `${bar.rail.fromPct}%`, width: `${bar.rail.toPct - bar.rail.fromPct}%` }} />}
          {bar.ticks.map((t, i) => {
            const isMotion = motion !== null && motion.threshold === t.threshold
            return (
              <span
                key={`${t.threshold}-${isMotion ? motion.n : 0}`}
                className={cn(
                  'sk-tick',
                  `sk-tick-${t.state}`,
                  bar.topReached && i === bar.ticks.length - 1 && 'sk-tick-top',
                  isMotion && (motion.kind === 'gain' ? 'sk-pop' : 'sk-dimmed'),
                )}
                style={at(t.pct)}
              />
            )
          })}
        </div>
        <div aria-hidden="true" className="relative mt-1.5 h-4 font-mono text-[10px] text-muted-foreground">
          {bar.zeroLabel && (
            <span className="absolute -translate-x-1/2" style={at(bar.zeroPct)}>
              0
            </span>
          )}
          {bar.ticks.map(
            (t) =>
              t.labelVisible && (
                <span key={t.threshold} className="absolute -translate-x-1/2" style={at(t.pct)}>
                  {formatPoints(t.threshold)}
                </span>
              ),
          )}
        </div>
      </div>
    </div>
  )
}
