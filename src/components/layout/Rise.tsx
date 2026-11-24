import { useState, type ReactNode } from 'react'
import { PLAY_ENTRANCE } from '@/lib/motion'
import { cn } from '@/lib/utils'

/** Entrance wrapper: plays once per session, then drops its animation class so tab switches don't replay it. */
export function Rise({ delay = 0, className, children }: { delay?: number; className?: string; children: ReactNode }) {
  const [playing, setPlaying] = useState(PLAY_ENTRANCE)
  return (
    <div
      className={cn(playing && 'rise-in', className)}
      style={playing ? ({ '--stagger': `${delay}ms` } as React.CSSProperties) : undefined}
      onAnimationEnd={() => setPlaying(false)}
    >
      {children}
    </div>
  )
}
