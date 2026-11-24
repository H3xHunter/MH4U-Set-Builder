import { useEffect, useRef, useState } from 'react'
import { SkillChip, SlotRings, type TreeName } from '@/components/equipment/parts'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/Modal'
import type { GameData, SavedCharm } from '@/data/types'
import {
  charmLabel,
  charmSkillEntries,
  draftInput,
  draftOf,
  draftProblem,
  editConflict,
  emptyDraft,
  isDirty,
  type CharmDraft,
} from '@/lib/charmView'
import type { CharmInput } from '@/lib/charms'
import { MAX_CHARMS } from '@/lib/charms'
import { cn } from '@/lib/utils'
import { CharmEditor } from './CharmEditor'
import { keyHint } from './pickerStyles'

type View =
  | { kind: 'list' }
  | {
      kind: 'edit'
      id: string | null
      /** The charm as the editor opened it, to notice changes made in another tab. */
      base: SavedCharm | null
      start: CharmDraft
      draft: CharmDraft
      chooser: number | null
      /** The inline "Discard changes?" confirm is showing. */
      discarding: boolean
    }
type Result = { ok: true } | { ok: false; errors: string[] }

function CharmRow({
  charm,
  equipped,
  manage,
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
  /** Manage mode has no Equip. */
  manage: boolean
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
            <Button size="sm" variant="destructive" data-confirm={charm.id} onClick={onDelete}>
              Confirm delete
            </Button>
            <Button size="sm" variant="outline" onClick={() => onConfirm(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            {!manage && (
              <Button size="sm" disabled={equipped} {...(equipped ? {} : { 'data-primary': charm.id })} aria-label={`Equip ${label}`} onClick={onEquip}>
                Equip
              </Button>
            )}
            <Button size="sm" variant="outline" {...(manage || equipped ? { 'data-primary': charm.id } : {})} aria-label={`Edit ${label}`} onClick={onEdit}>
              Edit
            </Button>
            <Button size="sm" variant="outline" aria-label={`Duplicate ${label}`} onClick={onCopy}>
              Duplicate
            </Button>
            <Button size="sm" variant="ghost" data-delete={charm.id} aria-label={`Delete ${label}`} onClick={() => onConfirm(true)}>
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
  loadNotice,
  manage,
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
  /** From the last load of the saved charms (see summarizeIssues). */
  loadNotice: { unreadable: number; storageUnavailable: boolean }
  /** Manage mode (from the header): no Equip, and nothing here changes the build. */
  manage: boolean
  onEquip: (id: string | null) => void
  onSave: (input: CharmInput, id: string | null) => Result
  onDelete: (id: string) => void
  onCopy: (id: string) => Result
}) {
  const [view, setView] = useState<View>({ kind: 'list' })
  const [confirming, setConfirming] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [copyError, setCopyError] = useState<string | null>(null)
  const pendingFocus = useRef<string | null>(null)

  // Focus requested by a handler, applied after the render that changed the DOM (the old element is gone by then).
  useEffect(() => {
    if (pendingFocus.current === null) return
    document.querySelector<HTMLElement>(`dialog[open] ${pendingFocus.current}`)?.focus()
    pendingFocus.current = null
  })

  const backToList = () => {
    setSaveError(null)
    setView({ kind: 'list' })
  }
  // Functional update: the editor sets the draft and the chooser in the same event, and both must stick.
  const patchEdit = (p: Partial<{ draft: CharmDraft; chooser: number | null; discarding: boolean }>) =>
    setView((v) => (v.kind === 'edit' ? { ...v, ...p } : v))
  const openEditor = (id: string | null, base: SavedCharm | null) => {
    const start = base ? draftOf(base) : emptyDraft()
    setView({ kind: 'edit', id, base, start, draft: start, chooser: null, discarding: false })
  }

  const editing = view.kind === 'edit' ? view : null
  const dirty = editing !== null && isDirty(editing.draft, editing.start)
  const conflict = editing ? editConflict(editing.base, charms.find((c) => c.id === editing.id)) : null
  // After a conflict the draft can only be saved as a new charm.
  const saveAsNew = editing !== null && (editing.id === null || conflict !== null)
  // Leaving the editor (Esc, Cancel, the X): a dirty draft asks first, an untouched one just goes.
  const requestBack = () => (dirty ? patchEdit({ discarding: true }) : backToList())
  const guardedClose = () => (open && dirty ? patchEdit({ discarding: true }) : onClose())

  const onEscape = () => {
    if (!editing) onClose()
    else if (editing.chooser !== null) patchEdit({ chooser: null })
    else if (editing.discarding) patchEdit({ discarding: false })
    else requestBack()
  }

  const deleteRow = (id: string) => {
    const at = charms.findIndex((c) => c.id === id)
    const neighbour = charms[at + 1] ?? charms[at - 1]
    pendingFocus.current = neighbour ? `[data-primary="${neighbour.id}"]` : '[data-new-charm]'
    setConfirming(null)
    onDelete(id)
  }

  return (
    <Modal
      open={open}
      onClose={guardedClose}
      onEscape={onEscape}
      closeOnBackdrop={!dirty}
      fallbackFocus='[data-trigger="charm"]'
      title={editing ? (editing.id === null ? 'New charm' : 'Edit charm') : manage ? 'Your charms' : 'Charms'}
      description="Your saved charms. Create, edit, duplicate and delete them; equip one from the charm card. Escape goes back one step."
      className="[--modal-max:36rem]"
    >
      {editing ? (
        <CharmEditor
          data={data}
          draft={editing.draft}
          onDraft={(draft) => patchEdit({ draft })}
          chooser={editing.chooser}
          onChooser={(chooser) => patchEdit({ chooser })}
          problem={draftProblem(editing.draft, charms.length, saveAsNew)}
          error={saveError}
          isNew={editing.id === null}
          conflict={conflict}
          discarding={editing.discarding}
          onKeep={() => patchEdit({ discarding: false })}
          onDiscard={backToList}
          onCancel={requestBack}
          onSave={() => {
            const r = onSave(draftInput(editing.draft), saveAsNew ? null : editing.id)
            if (r.ok) backToList()
            else setSaveError(r.errors.join('; '))
          }}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 border-b p-4">
            <Button autoFocus data-autofocus data-new-charm disabled={charms.length >= MAX_CHARMS} onClick={() => openEditor(null, null)}>
              New charm
            </Button>
            {!manage && equippedId !== null && (
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
          {loadNotice.storageUnavailable && (
            <p role="alert" className="border-b px-4 py-2 text-xs text-destructive">
              Browser storage is unavailable or unreadable, so charm changes will not be saved.
            </p>
          )}
          {loadNotice.unreadable > 0 && (
            <p role="status" className="border-b px-4 py-2 text-xs text-muted-foreground">
              Some saved charms could not be loaded. A copy of the original is kept in your browser storage.
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
                  manage={manage}
                  treeName={treeName}
                  confirming={confirming === c.id}
                  onConfirm={(on) => {
                    pendingFocus.current = on ? `[data-confirm="${c.id}"]` : `[data-delete="${c.id}"]`
                    setConfirming(on ? c.id : null)
                  }}
                  onEquip={() => {
                    onEquip(c.id)
                    onClose()
                  }}
                  onEdit={() => openEditor(c.id, c)}
                  onCopy={() => {
                    const r = onCopy(c.id)
                    setCopyError(r.ok ? null : r.errors.join('; '))
                  }}
                  onDelete={() => deleteRow(c.id)}
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
