import { Minus, Plus, X } from 'lucide-react'
import { useMemo, useState, type KeyboardEvent } from 'react'
import { Segmented } from '@/components/layout/Segmented'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { GameData, SlotCount } from '@/data/types'
import { charmTier, EDITOR_MAX_SKILLS, findSkills, stepPoints, type CharmDraft } from '@/lib/charmView'
import { CHARM_NAME_MAX, CHARM_POINTS_LIMIT } from '@/lib/charms'
import { signed } from '@/lib/rarity'
import { cn } from '@/lib/utils'
import { keyHint } from './pickerStyles'
import { useListbox } from './useListbox'

const SLOT_OPTIONS = ['0', '1', '2', '3'].map((v) => ({ value: v, label: v })) as readonly { value: '0' | '1' | '2' | '3'; label: string }[]

function Stepper({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    onChange(stepPoints(value, e.key === 'ArrowUp' ? 1 : -1))
  }
  return (
    <div role="group" aria-label={`Points for ${label}`} className="flex items-center gap-1">
      <Button type="button" variant="outline" size="icon" aria-label="Decrease points" disabled={value <= -CHARM_POINTS_LIMIT} onClick={() => onChange(stepPoints(value, -1))}>
        <Minus aria-hidden />
      </Button>
      <span
        role="spinbutton"
        tabIndex={0}
        aria-label={`${label} points`}
        aria-valuenow={value}
        aria-valuemin={-CHARM_POINTS_LIMIT}
        aria-valuemax={CHARM_POINTS_LIMIT}
        className={cn(
          'w-12 rounded-md border bg-background py-1.5 text-center font-mono text-sm tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
          value < 0 ? 'text-skill-negative' : 'text-skill-positive',
        )}
        onKeyDown={onKey}
      >
        {signed(value)}
      </span>
      <Button type="button" variant="outline" size="icon" aria-label="Increase points" disabled={value >= CHARM_POINTS_LIMIT} onClick={() => onChange(stepPoints(value, 1))}>
        <Plus aria-hidden />
      </Button>
    </div>
  )
}

/** Searchable skill list shown in place of the form while a row picks its skill. Esc (handled by the picker) goes back. */
function SkillChooser({ data, exclude, onChoose }: { data: GameData; exclude: number[]; onChoose: (id: number) => void }) {
  const [query, setQuery] = useState('')
  const results = useMemo(() => findSkills(data.skills, query, exclude), [data, query, exclude])
  const lb = useListbox(results.length, (i) => onChoose(results[i].id))
  return (
    <>
      <div className="border-b p-4">
        <Input
          type="text"
          autoFocus
          data-autofocus
          placeholder="Search skills"
          aria-label="Search skills"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            lb.reset()
          }}
          onKeyDown={lb.onKeyDown}
          {...lb.comboProps}
        />
      </div>
      <p className="px-4 py-2 text-xs text-muted-foreground" aria-live="polite">
        {results.length} {results.length === 1 ? 'skill' : 'skills'}
      </p>
      <ul id={lb.listboxId} role="listbox" aria-label="Skills" className="min-h-0 flex-1 overflow-y-auto border-t">
        {results.map((t, i) => (
          <li
            key={t.id}
            id={lb.optionId(i)}
            role="option"
            aria-selected={i === lb.active}
            className={cn('cursor-pointer border-b px-4 py-2', i === lb.active ? 'bg-row-hover' : 'hover:bg-row-hover/60')}
            onClick={() => onChoose(t.id)}
          >
            {t.name}
          </li>
        ))}
      </ul>
      <p className={keyHint}>Up/Down move, Enter choose, Esc back</p>
    </>
  )
}

export function CharmEditor({
  data,
  draft,
  onDraft,
  chooser,
  onChooser,
  problem,
  error,
  isNew,
  onSave,
  onCancel,
}: {
  data: GameData
  draft: CharmDraft
  onDraft: (d: CharmDraft) => void
  /** Row index that is choosing a skill, or null. */
  chooser: number | null
  onChooser: (row: number | null) => void
  problem: string | null
  error: string | null
  isNew: boolean
  onSave: () => void
  onCancel: () => void
}) {
  const [lastRow, setLastRow] = useState<number | null>(null)
  const trees = useMemo(() => new Map(data.skills.map((t) => [t.id, t])), [data])

  if (chooser !== null) {
    const exclude = draft.rows.flatMap((r, i) => (i !== chooser && r.skillId !== null ? [r.skillId] : []))
    return (
      <SkillChooser
        data={data}
        exclude={exclude}
        onChoose={(id) => {
          setLastRow(chooser)
          onDraft({ ...draft, rows: draft.rows.map((r, i) => (i === chooser ? { ...r, skillId: id } : r)) })
          onChooser(null)
        }}
      />
    )
  }

  const setRow = (i: number, points: number) => onDraft({ ...draft, rows: draft.rows.map((r, j) => (j === i ? { ...r, points } : r)) })
  const preview = draft.rows.flatMap((r) => {
    const tree = r.skillId === null ? undefined : trees.get(r.skillId)
    return tree ? [{ name: tree.name, points: r.points, tier: charmTier(tree, r.points) }] : []
  })

  return (
    <>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Name (optional)</span>
          <Input
            type="text"
            autoFocus
            data-autofocus
            maxLength={CHARM_NAME_MAX}
            placeholder="Leave empty to use a summary of its skills"
            value={draft.name}
            onChange={(e) => onDraft({ ...draft, name: e.target.value })}
          />
        </label>

        <div className="space-y-2">
          <p className="text-sm font-medium">Skills</p>
          {draft.rows.length === 0 && <p className="text-sm text-muted-foreground">No skills. A charm with slots only is fine.</p>}
          {draft.rows.map((r, i) => {
            const name = r.skillId === null ? 'skill' : (trees.get(r.skillId)?.name ?? `#${r.skillId}`)
            return (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-w-0 flex-1 justify-start truncate"
                  autoFocus={lastRow === i}
                  onClick={() => onChooser(i)}
                >
                  {r.skillId === null ? 'Choose a skill' : name}
                </Button>
                <Stepper value={r.points} label={name} onChange={(p) => setRow(i, p)} />
                <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${name} row`} onClick={() => onDraft({ ...draft, rows: draft.rows.filter((_, j) => j !== i) })}>
                  <X aria-hidden />
                </Button>
              </div>
            )
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={draft.rows.length >= EDITOR_MAX_SKILLS}
            onClick={() => {
              onDraft({ ...draft, rows: [...draft.rows, { skillId: null, points: 1 }] })
              onChooser(draft.rows.length)
            }}
          >
            <Plus aria-hidden /> Add skill
          </Button>
          {draft.rows.length > EDITOR_MAX_SKILLS && (
            <p className="text-xs text-muted-foreground">This charm has more than {EDITOR_MAX_SKILLS} skills; all are kept.</p>
          )}
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-medium">Slots</p>
          <Segmented
            value={String(draft.slots) as '0' | '1' | '2' | '3'}
            onChange={(v) => onDraft({ ...draft, slots: Number(v) as SlotCount })}
            options={SLOT_OPTIONS}
            label="Charm slots"
          />
        </div>

        <div className="space-y-1" aria-live="polite">
          <p className="text-sm font-medium">This charm alone</p>
          {preview.length === 0 ? (
            <p className="text-sm text-muted-foreground">No skills.</p>
          ) : (
            preview.map((p, i) => (
              <p key={i} className="text-sm">
                <span className="font-mono text-muted-foreground">{p.name} {signed(p.points)}</span>
                {' → '}
                {p.tier ? <span className="font-medium">{p.tier.name}</span> : <span className="text-muted-foreground">no tier yet</span>}
              </p>
            ))
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
        <p className={cn('min-w-0 flex-1 text-xs', error ? 'text-destructive' : 'text-muted-foreground')} role={error ? 'alert' : undefined}>
          {error ?? problem ?? ''}
        </p>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" disabled={problem !== null} onClick={onSave}>
          {isNew ? 'Save charm' : 'Save changes'}
        </Button>
      </div>
    </>
  )
}
