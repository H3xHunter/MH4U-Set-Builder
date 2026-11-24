import { Swords } from 'lucide-react'
import { PLAY_STYLES, Segmented, type PlayStyle } from './Segmented'

export function Header({ style, onStyle }: { style: PlayStyle; onStyle: (s: PlayStyle) => void }) {
  return (
    <header className="border-b bg-surface">
      <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-3">
        <Swords aria-hidden className="size-6 text-primary" />
        <h1 className="font-display text-xl font-bold uppercase tracking-[0.1em]">MH4U Set Builder</h1>
        <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">Fan tool</span>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden lg:block">
            <Segmented value={style} onChange={onStyle} options={PLAY_STYLES} label="Hunter class" />
          </div>
        </div>
      </div>
    </header>
  )
}
