import { useState } from 'react'
import { formatPoints, formatSigned, type SkillView } from '@/lib/skillBar'
import { cn } from '@/lib/utils'
import { SkillBar, type TickMotion } from './SkillBar'

const tierName = (t: { name: string } | null) => (t ? t.name : 'No tier')

/**
 * Compares the previous total tier (kept in state, not a timer) with the current one while rendering.
 * A row that mounts does not animate, so first render and a skill's first appearance stay still.
 */
function useTierMotion(view: SkillView): { motion: TickMotion | null } {
  const tier = view.totalTier?.points ?? null
  const [prev, setPrev] = useState({ tier, total: view.total })
  const [motion, setMotion] = useState<TickMotion | null>(null)
  if (prev.tier !== tier) {
    const gain = view.total > prev.total
    setPrev({ tier, total: view.total })
    setMotion((m) => ({ kind: gain ? 'gain' : 'loss', n: (m?.n ?? 0) + 1, threshold: gain ? (tier ?? prev.tier) : (prev.tier ?? tier) }))
  } else if (prev.total !== view.total) {
    setPrev({ tier, total: view.total })
  }
  return { motion }
}

export function SkillRow({ view }: { view: SkillView }) {
  const { motion } = useTierMotion(view)
  const sameTier = (view.baseTier?.points ?? null) === (view.totalTier?.points ?? null)
  const negativeTotal = view.totalTier !== null && view.totalTier.points < 0
  return (
    <li className="relative space-y-1.5 rounded-lg border bg-card px-3 py-2.5">
      {motion?.kind === 'gain' && <span key={motion.n} aria-hidden="true" className="sk-flash pointer-events-none absolute inset-0 rounded-lg" />}
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="font-medium">{view.name}</span>
        <span className="flex flex-wrap items-baseline gap-x-1.5 font-mono text-sm">
          <span>{formatPoints(view.shownBase)}</span>
          {view.torsoUp !== 0 && <span className="text-torso-up-extra">{formatSigned(view.torsoUp)} TU</span>}
          {view.deco !== 0 && <span className="text-deco-total">({formatSigned(view.deco)})</span>}
          <span className="font-bold text-deco-total">{formatPoints(view.total)}</span>
        </span>
      </div>
      {(view.bar.overMax > 0 || view.bar.underMin > 0) && (
        <div className="flex gap-1.5 text-[11px]">
          {view.bar.overMax > 0 && (
            <span className="rounded border border-deco-total/50 px-1.5 font-mono text-deco-total">+{view.bar.overMax} over max</span>
          )}
          {view.bar.underMin > 0 && (
            <span className="rounded border border-skill-negative/50 px-1.5 font-mono text-skill-negative">{view.bar.underMin} past min</span>
          )}
        </div>
      )}
      <SkillBar view={view} motion={motion} />
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
        <span className="uppercase tracking-wider">Base</span>
        <span className="text-foreground">{tierName(view.baseTier)}</span>
        <span aria-label={sameTier ? 'same as' : 'becomes'}>{sameTier ? '=' : '→'}</span>
        <span className="uppercase tracking-wider">With decos</span>
        <span
          key={motion?.n ?? 0}
          className={cn(
            'rounded border px-1.5 py-px',
            negativeTotal ? 'border-skill-negative/50 text-skill-negative' : 'border-deco-total/50 text-deco-total',
            motion && 'sk-label-in',
          )}
        >
          {tierName(view.totalTier)}
        </span>
      </p>
      {view.hint.text && (
        <p className={cn('text-xs', view.hint.near ? 'text-skill-positive' : 'text-muted-foreground')}>{view.hint.text}</p>
      )}
      {/* Only the tier is announced, so a point change inside the same tier stays silent. */}
      <span className="sr-only" aria-live="polite">
        {view.name}: {tierName(view.totalTier)}
      </span>
    </li>
  )
}
