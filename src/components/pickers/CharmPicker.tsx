import { useState } from 'react'
import { SkillChip, SlotRings, type TreeName } from '@/components/equipment/parts'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/Modal'
import type { GameData, SavedCharm } from '@/data/types'
import { charmLabel, charmSkillEntries, draftInput, draftOf, draftProblem, emptyDraft, type CharmDraft } from '@/lib/charmView'
import type { CharmInput } from '@/lib/charms'
import { MAX_CHARMS } from '@/lib/charms'
import { cn } from '@/lib/utils'
import { CharmEditor } from './CharmEditor'
import { keyHint } from './pickerStyles'

type View = { kind: 'list' } | { kind: 'edit'; id: string | null; draft: CharmDraft; chooser: number | null }
type Result = { ok: true } | { ok: false; errors: string[] }

function CharmRow({
  charm,
  equipped,
  treeName,
  confirming,
  onConfirm,
  onEquip,
  onEdit,
  onCopy,
  onDelete,
}: {
  charm: SavedCharm
  equipped: boolean
  treeName: TreeName
  confirming: boolean
  onConfirm: (on: boolean) => void
  onEquip: () => void
  onEdit: () => void
  onCopy: () => void
  onDelete: () => void
}) {
  const label = charmLabel(charm, treeName)
  return (
    <li className={cn('space-y-2 border-b px-4 py-3', equipped && 'bg-row-hover')}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="min-w-0 truncate font-medium">{label}</span>
        {equipped && <span className="rounded border border-primary px-1 text-[11px] leading-4 text-primary">Equipped</span>}
        <SlotRings count={charm.slots} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {charmSkillEntries(charm).map(([id, p]) => (
          <SkillChip key={id} name={treeName(id)} points={p} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {confirming ? (
          <>
            <span className="text-sm">Delete this charm?</span>
            <Button size="sm" variant="destructive" autoFocus onClick={onDelete}>
              Confirm delete
            </Button>
            <Button size="sm" variant="outline" onClick={() => onConfirm(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" disabled={equipped} aria-label={`Equip ${label}`} onClick={onEquip}>
              Equip
            </Button>
            <Button size="sm" variant="outline" aria-label={`Edit ${label}`} onClick={onEdit}>
              Edit
            </Button>
            <Button size="sm" variant="outline" aria-label={`Duplicate ${label}`} onClick={onCopy}>
              Duplicate
            </Button>
            <Button size="sm" variant="ghost" aria-label={`Delete ${label}`} onClick={() => onConfirm(true)}>
              Delete
            </Button>
          </>
        )}
      </div>
    </li>
  )
}

/** One modal, two views (list, editor). Mount it with a new `key` per open so it starts on the list. */
export function CharmPicker({
  open,
  onClose,
  data,
  charms,
  equippedId,
  treeName,
  storageError,
  issueCount,
  onEquip,
  onSave,
  onDelete,
  onCopy,
}: {
  open: boolean
  onClose: () => void
  data: GameData
  charms: SavedCharm[]
  equippedId: string | null
  treeName: TreeName
  storageError: string | null
  /** Stored charms that could not be loaded (a backup was kept). */
  issueCount: number
  onEquip: (id: string | null) => void
  onSave: (input: CharmInput, id: string | null) => Result
  onDelete: (id: string) => void
  onCopy: (id: string) => Result
}) {
  const [view, setView] = useState<View>({ kind: 'list' })
  const [confirming, setConfirming] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [copyError, setCopyError] = useState<string | null>(null)
  const backToList = () => {
    setSaveError(null)
    setView({ kind: 'list' })
  }
  // Functional update: the editor sets the draft and the chooser in the same event, and both must stick.
  const patchEdit = (p: Partial<{ draft: CharmDraft; chooser: number | null }>) =>
    setView((v) => (v.kind === 'edit' ? { ...v, ...p } : v))
  const newCharm = () => setView({ kind: 'edit', id: null, draft: emptyDraft(), chooser: null })

  const onEscape = () => {
    if (view.kind === 'list') onClose()
    else if (view.chooser !== null) setView({ ...view, chooser: null })
    else backToList()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      onEscape={onEscape}
      fallbackFocus='[data-trigger="charm"]'
      title={view.kind === 'list' ? 'Charms' : view.id === null ? 'New charm' : 'Edit charm'}
      description="Your saved charms. Equip one, or create and edit charms. Escape goes back one step."
      className="[--modal-max:36rem]"
    >
      {view.kind === 'edit' ? (
        <CharmEditor
          data={data}
          draft={view.draft}
          onDraft={(draft) => patchEdit({ draft })}
          chooser={view.chooser}
          onChooser={(chooser) => patchEdit({ chooser })}
          problem={draftProblem(view.draft, charms.length, view.id === null)}
          error={saveError}
          isNew={view.id === null}
          onCancel={backToList}
          onSave={() => {
            const r = onSave(draftInput(view.draft), view.id)
            if (r.ok) backToList()
            else setSaveError(r.errors.join('; '))
          }}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 border-b p-4">
            <Button autoFocus data-autofocus disabled={charms.length >= MAX_CHARMS} onClick={newCharm}>
              New charm
            </Button>
            {equippedId !== null && (
              <Button variant="outline" onClick={() => onEquip(null)}>
                No charm
              </Button>
            )}
            <span className="ml-auto font-mono text-xs text-muted-foreground">
              {charms.length} / {MAX_CHARMS}
            </span>
          </div>
          {storageError && (
            <p role="alert" className="border-b px-4 py-2 text-xs text-destructive">
              Could not save to this browser ({storageError}). Your charms are kept until you close or reload the page.
            </p>
          )}
          {copyError && (
            <p role="alert" className="border-b px-4 py-2 text-xs text-destructive">
              {copyError}
            </p>
          )}
          {issueCount > 0 && (
            <p className="border-b px-4 py-2 text-xs text-muted-foreground">
              {issueCount} stored {issueCount === 1 ? 'entry' : 'entries'} could not be loaded. The original was kept in a backup in this browser.
            </p>
          )}
          {charms.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              No charms yet. Create one with its skills and slots, then equip it. Charms stay in this browser.
            </p>
          ) : (
            <ul aria-label="Your charms" className="min-h-0 flex-1 overflow-y-auto">
              {charms.map((c) => (
                <CharmRow
                  key={c.id}
                  charm={c}
                  equipped={c.id === equippedId}
                  treeName={treeName}
                  confirming={confirming === c.id}
                  onConfirm={(on) => setConfirming(on ? c.id : null)}
                  onEquip={() => {
                    onEquip(c.id)
                    onClose()
                  }}
                  onEdit={() => setView({ kind: 'edit', id: c.id, draft: draftOf(c), chooser: null })}
                  onCopy={() => {
                    const r = onCopy(c.id)
                    setCopyError(r.ok ? null : r.errors.join('; '))
                  }}
                  onDelete={() => {
                    setConfirming(null)
                    onDelete(c.id)
                  }}
                />
              ))}
            </ul>
          )}
          <p className={cn(keyHint, 'mt-auto')}>Esc close</p>
        </>
      )}
    </Modal>
  )
}
