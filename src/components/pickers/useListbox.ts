import { useEffect, useId, useState, type KeyboardEvent } from 'react'

/**
 * ARIA combobox/listbox keyboard model. Focus stays in the search input, which gets
 * `aria-activedescendant`; options get `id = optionId(i)`. Up/Down/Home/End move, Enter chooses.
 * Esc is handled by the Dialog.
 */
export function useListbox(count: number, onChoose: (index: number) => void) {
  const base = useId()
  const [requested, setActive] = useState(0)
  const active = count === 0 ? -1 : Math.min(requested, count - 1)
  const optionId = (i: number) => `${base}-opt-${i}`

  useEffect(() => {
    if (active >= 0) document.getElementById(`${base}-opt-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, base])

  const onKeyDown = (e: KeyboardEvent) => {
    const move = (to: number) => {
      e.preventDefault()
      setActive(Math.max(0, Math.min(count - 1, to)))
    }
    if (e.key === 'ArrowDown') move(active + 1)
    else if (e.key === 'ArrowUp') move(active - 1)
    else if (e.key === 'Home') move(0)
    else if (e.key === 'End') move(count - 1)
    else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault()
      onChoose(active)
    }
  }

  return {
    active,
    optionId,
    listboxId: `${base}-list`,
    reset: () => setActive(0),
    onKeyDown,
    comboProps: {
      role: 'combobox' as const,
      'aria-expanded': true,
      'aria-controls': `${base}-list`,
      'aria-activedescendant': active >= 0 ? optionId(active) : undefined,
      'aria-autocomplete': 'list' as const,
    },
  }
}
