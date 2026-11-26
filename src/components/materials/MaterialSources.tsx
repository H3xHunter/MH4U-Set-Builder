import { useId, useMemo, useState, type ReactNode } from 'react'
import type { GameData, Material, Rank } from '@/data/types'
import { formatChance, sourceView } from '@/lib/materialSources'

const SHOWN = 6
const SLOT_LABEL: Record<string, string> = { A: 'A reward', B: 'B reward', Sub: 'Sub-quest reward' }

function RankTag({ rank }: { rank: Rank }) {
  return <span className="rounded border px-1 font-mono text-[10px] leading-4 text-muted-foreground">{rank}</span>
}

const Dot = () => (
  <span aria-hidden="true" className="text-muted-foreground/60">
    {' · '}
  </span>
)

function Group<T>({ title, rows, render }: { title: string; rows: T[]; render: (row: T) => ReactNode }) {
  const [all, setAll] = useState(false)
  const id = useId()
  if (rows.length === 0) return null
  const shown = all ? rows : rows.slice(0, SHOWN)
  return (
    <div>
      <h4 id={id} className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      <ul aria-labelledby={id} className="space-y-1">
        {shown.map((r, i) => (
          <li key={i} className="text-sm leading-snug">
            {render(r)}
          </li>
        ))}
      </ul>
      {rows.length > SHOWN && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          aria-expanded={all}
          className="mt-1 text-xs text-deco-total underline-offset-2 hover:underline"
        >
          {all ? 'Show fewer' : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  )
}

const Times = ({ n }: { n: number }) =>
  n > 1 ? (
    <span className="ml-1 font-mono text-xs text-muted-foreground" title={`${n} identical rows in the data`}>
      ×{n}
    </span>
  ) : null

/** Drops, gathering and quest rewards of one material. Rendered only while its row is expanded. */
export function MaterialSources({ material, data }: { material: Material; data: GameData }) {
  const v = useMemo(() => sourceView(material, data), [material, data])
  if (v.coverage === 'none') return <p className="text-sm text-muted-foreground">No source in the data.</p>
  if (v.coverage === 'otherOnly') {
    return (
      <p className="text-sm text-muted-foreground">
        No monster, gathering or quest source shown. Also from: {v.otherKinds.join(', ')}.
      </p>
    )
  }
  return (
    <div className="space-y-3">
      <Group
        title="Monster drops"
        rows={v.drops}
        render={(d) => (
          <>
            {d.monsterName}
            <Dot />
            {d.condition}
            <Dot />
            <span className="font-mono">{formatChance(d.percentage)}</span>
            {d.stackSize > 1 && <span className="font-mono text-xs text-muted-foreground"> qty {d.stackSize}</span>}
            <span className="ml-1.5">
              <RankTag rank={d.rank} />
            </span>
            <Times n={d.count} />
          </>
        )}
      />
      <Group
        title="Gathering"
        rows={v.gathering}
        render={(g) => (
          <>
            {g.locationName}
            <Dot />
            {g.area}
            <Dot />
            {g.site}
            <Dot />
            <span className="font-mono">{formatChance(g.percentage)}</span>
            <span className="font-mono text-xs text-muted-foreground"> qty {g.quantity}</span>
            <span className="ml-1.5">
              <RankTag rank={g.rank} />
            </span>
            <Times n={g.count} />
          </>
        )}
      />
      <Group
        title="Quest rewards"
        rows={v.quests}
        render={(q) => (
          <>
            {q.questName}
            {q.hub !== null && (
              <>
                <Dot />
                {q.hub}
              </>
            )}
            {q.stars !== null && (
              <>
                <Dot />
                {q.stars} {q.stars === 1 ? 'star' : 'stars'}
              </>
            )}
            <Dot />
            {SLOT_LABEL[q.slot] ?? `${q.slot} reward`}
            <Dot />
            <span className="font-mono">{formatChance(q.percentage)}</span>
            {q.stackSize > 1 && <span className="font-mono text-xs text-muted-foreground"> qty {q.stackSize}</span>}
            <Times n={q.count} />
          </>
        )}
      />
    </div>
  )
}
