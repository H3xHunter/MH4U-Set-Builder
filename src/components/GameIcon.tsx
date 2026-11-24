import type { CSSProperties } from 'react'
import type { ArmorSlot, DecorationColor } from '@/data/types'
import { armorIcon, charmIcon, decorationIcon, ICON_SIZE, weaponIcon } from '@/lib/icons'

export type IconScale = 0.5 | 1 | 2 | 3 | 4

export type GameIconProps = { scale?: IconScale } & (
  | { kind: 'armor'; slot: ArmorSlot; rarity: number }
  | { kind: 'weapon'; weaponClass: string; rarity: number }
  | { kind: 'decoration'; color: DecorationColor }
  | { kind: 'charm' }
)

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const validRarity = (r: number) => Number.isInteger(r) && r >= 1 && r <= 10

function describe(p: GameIconProps): { url: string | undefined; tint: string | null; alt: string; size: number } {
  switch (p.kind) {
    case 'armor':
      return {
        url: armorIcon(p.slot),
        tint: validRarity(p.rarity) ? `var(--rarity-${p.rarity})` : null,
        alt: `${cap(p.slot)} armor, rarity ${p.rarity}`,
        size: ICON_SIZE.armor,
      }
    case 'weapon':
      return {
        url: weaponIcon(p.weaponClass),
        tint: validRarity(p.rarity) ? `var(--rarity-${p.rarity})` : null,
        alt: `${p.weaponClass}, rarity ${p.rarity}`,
        size: ICON_SIZE.weapon,
      }
    case 'decoration':
      return {
        url: decorationIcon(),
        tint: `var(--jewel-${p.color})`,
        alt: `${cap(p.color)} decoration`,
        size: ICON_SIZE.decoration,
      }
    case 'charm':
      return { url: charmIcon(), tint: null, alt: 'Charm', size: ICON_SIZE.charm }
  }
}

const pixelated: CSSProperties = { imageRendering: 'pixelated' }

/** White-base icon: the img is layer 1, a masked color span multiplied on top is layer 2 (not for charms). */
export function GameIcon(props: GameIconProps) {
  const { url, tint, alt, size } = describe(props)
  const px = size * (props.scale ?? 1)
  const box: CSSProperties = { width: px, height: px }

  if (!url) {
    return (
      <span
        role="img"
        aria-label={alt}
        className="inline-flex items-center justify-center rounded border border-dashed text-xs text-muted-foreground"
        style={box}
      >
        ?
      </span>
    )
  }

  const mask = `url(${JSON.stringify(url)})`
  return (
    <span className="relative inline-block align-middle" style={{ ...box, isolation: 'isolate' }}>
      <img src={url} alt={alt} width={px} height={px} className="block" style={{ ...box, ...pixelated }} />
      {tint && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            ...pixelated,
            backgroundColor: tint,
            maskImage: mask,
            WebkitMaskImage: mask,
            maskSize: '100%',
            WebkitMaskSize: '100%',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
            mixBlendMode: 'multiply',
          }}
        />
      )}
    </span>
  )
}
