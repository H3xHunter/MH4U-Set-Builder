import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: readonly { value: T; label: string }[]
  label: string
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={value}
      aria-label={label}
      // Radix sends '' when the active item is clicked again; a segmented control always keeps one value.
      onValueChange={(v) => v && onChange(v as T)}
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

export type PlayStyle = 'blade' | 'gunner'
export const PLAY_STYLES = [
  { value: 'blade', label: 'Blademaster' },
  { value: 'gunner', label: 'Gunner' },
] as const
