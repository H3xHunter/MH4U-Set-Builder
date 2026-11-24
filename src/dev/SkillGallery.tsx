import { useState } from 'react'
import { SkillRow } from '@/components/skills/SkillRow'
import { buildSkillView, type TierInfo } from '@/lib/skillBar'

// Synthetic inputs from the design's "Skill row variants". Thresholds are made up unless noted.
const t = (...points: number[]): TierInfo[] => points.map((p) => ({ points: p, name: `Tier ${p > 0 ? '+' : '−'}${Math.abs(p)}` }))
const NEG = [-20, -15, -10, 10, 15]

const VARIANTS = [
  { name: 'One tier (Handicraft)', tiers: t(10), shownBase: 7, torsoUp: 0, deco: 2 },
  { name: 'Two tiers (Guard)', tiers: t(10, 15), shownBase: 8, torsoUp: 0, deco: 4 },
  { name: 'Four tiers + Torso Up (Attack)', tiers: t(10, 15, 20, 25), shownBase: 9, torsoUp: 4, deco: 5 },
  { name: 'Positive and negative (Fire Res)', tiers: t(...NEG), shownBase: 6, torsoUp: 0, deco: 4 },
  { name: 'Past the top', tiers: t(10), shownBase: 12, torsoUp: 0, deco: 5 },
  { name: 'Past the top, base too', tiers: t(10, 15, 20, 25), shownBase: 22, torsoUp: 0, deco: 6 },
  { name: 'Negative total (Hunger)', tiers: t(...NEG), shownBase: -14, torsoUp: 0, deco: 2 },
  { name: 'Negative base, positive total (Expert)', tiers: t(-20, -15, -10, 10, 15, 20), shownBase: -11, torsoUp: 0, deco: 13 },
  { name: 'Negative only (Fatigue)', tiers: t(-15, -10), shownBase: -8, torsoUp: 0, deco: 0 },
  { name: 'Negative deco on a positive base (my choice)', tiers: t(10, 20), shownBase: 12, torsoUp: 0, deco: -4 },
]

function GuardDemo() {
  const [jewels, setJewels] = useState(0)
  const view = buildSkillView({ treeId: 1, name: 'Guard (demo)', tiers: t(10, 15), shownBase: 8, torsoUp: 0, deco: jewels })
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">Tier-change motion: Guard base 8, thresholds 10 and 15</h2>
      <div className="flex gap-2">
        <button type="button" className="rounded border px-3 py-1" onClick={() => setJewels((j) => j - 1)}>
          − Guard Jewel
        </button>
        <button type="button" className="rounded border px-3 py-1" onClick={() => setJewels((j) => j + 1)}>
          + Guard Jewel
        </button>
        <span className="self-center font-mono text-sm">decorations: {jewels}</span>
      </div>
      <ul>
        <SkillRow view={view} />
      </ul>
    </section>
  )
}

export default function SkillGallery() {
  return (
    <div className="mx-auto max-w-md space-y-6 p-4">
      <h1 className="text-2xl font-bold">Skill gallery (dev only)</h1>
      <GuardDemo />
      <ul className="space-y-3">
        {VARIANTS.map((v, i) => (
          <li key={v.name} className="space-y-1">
            <p className="text-xs text-muted-foreground">{v.name}</p>
            <ul>
              <SkillRow view={buildSkillView({ treeId: i + 10, name: v.name.split(' (')[0], tiers: v.tiers, shownBase: v.shownBase, torsoUp: v.torsoUp, deco: v.deco })} />
            </ul>
          </li>
        ))}
      </ul>
    </div>
  )
}
