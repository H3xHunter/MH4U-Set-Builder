import type { Weapon, WeaponElement } from '@/data/types'

const MINUS = '−'
const pct = (n: number) => (n > 0 ? `+${n}%` : n < 0 ? `${MINUS}${-n}%` : '0%')

/** Two possible values (affinityOptions): the weapon randomly applies one of them. */
export const isDoubleAffinity = (w: Pick<Weapon, 'affinityOptions'>): boolean => w.affinityOptions !== null

/** "+30%", "−10%", "0%", or "−45% / +20%" (ascending) for a double-affinity weapon. */
export function formatAffinity(w: Pick<Weapon, 'affinity' | 'affinityOptions'>): string {
  if (w.affinityOptions) {
    const [a, b] = [...w.affinityOptions].sort((x, y) => x - y)
    return `${pct(a)} / ${pct(b)}`
  }
  return w.affinity === null ? '—' : pct(w.affinity)
}

export interface ElementPart {
  kind: 'element' | 'element2' | 'awaken'
  type: string
  value: number
  /** "Fire 250", or "Awaken Fire 430". What awakening does is not stated anywhere in the data. */
  label: string
}

const part = (kind: ElementPart['kind'], e: WeaponElement | null): ElementPart[] =>
  e ? [{ kind, type: e.type, value: e.value, label: `${kind === 'awaken' ? 'Awaken ' : ''}${e.type} ${e.value}` }] : []

export const elementParts = (w: Pick<Weapon, 'element' | 'element2' | 'awaken'>): ElementPart[] => [
  ...part('element', w.element),
  ...part('element2', w.element2),
  ...part('awaken', w.awaken),
]
