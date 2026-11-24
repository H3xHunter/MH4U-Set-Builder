import type { DecorationColor, Decoration } from '@/data/types'
import { signed } from '@/lib/rarity'
import { cn } from '@/lib/utils'

/** Skill name from the data (treeNames); an id missing from the data is shown as "#id" rather than hidden. */
export type TreeName = (id: number | string) => string

export function SkillChip({ name, points }: { name: string; points: number }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        points < 0
          ? 'border-skill-negative/40 bg-skill-negative/10 text-skill-negative'
          : 'border-skill-positive/40 bg-skill-positive/10 text-skill-positive',
      )}
    >
      {name}
      <span className="font-mono">{signed(points)}</span>
    </span>
  )
}

export function RarityBadge({ rarity }: { rarity: number }) {
  return <span className="rounded border px-1 font-mono text-[11px] leading-4 text-muted-foreground">R{rarity}</span>
}

/** N filled circles joined by 4px bridges, colored by the decoration's `color` field. */
export function JewelCircles({ size, color }: { size: number; color: DecorationColor }) {
  const fill = { backgroundColor: `var(--jewel-${color})` }
  return (
    <span aria-hidden="true" className="inline-flex items-center">
      {Array.from({ length: size }, (_, i) => (
        <span key={i} className="inline-flex items-center">
          {i > 0 && <span className="h-1.5 w-1 shrink-0" style={fill} />}
          <span className="size-3.5 shrink-0 rounded-full border border-black/40" style={fill} />
        </span>
      ))}
    </span>
  )
}

export function SlotRings({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${count} ${count === 1 ? 'slot' : 'slots'}`}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="size-2.5 rounded-full border-2 border-slot-free" />
      ))}
    </span>
  )
}

/** "+2 Guard Up" (blue) / "-1 Elemental" (red), in mono. */
export function DecoEffects({ deco, treeName }: { deco: Decoration; treeName: TreeName }) {
  return (
    <span className="font-mono text-xs">
      {Object.entries(deco.skills).map(([id, pts], i) => (
        <span key={id} className={cn(i > 0 && 'ml-2', pts < 0 ? 'text-skill-negative' : 'text-deco-total')}>
          {signed(pts)} {treeName(id)}
        </span>
      ))}
    </span>
  )
}
