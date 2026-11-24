import type { ArmorSlot } from '@/data/types'

export { WEAPON_CLASSES, type WeaponClass } from './weaponClass'

/** Native pixel sizes of the PNGs per category (checked against the files in icons.test.ts). */
export const ICON_SIZE = { armor: 64, weapon: 64, decoration: 50, charm: 64 } as const

const urls = import.meta.glob<string>('../assets/icons/**/*.png', { eager: true, query: '?url&no-inline', import: 'default' })

const find = (path: string): string | undefined => urls[`../assets/icons/${path}.png`]

export const weaponFileName = (weaponClass: string) => weaponClass.toLowerCase().replace(/ /g, '-')

/** Every lookup returns undefined for a missing icon; callers show a fallback. */
export const armorIcon = (slot: ArmorSlot) => find(`armor/${slot}`)
export const weaponIcon = (weaponClass: string) => find(`weapons/${weaponFileName(weaponClass)}`)
// Jewel color is applied by tinting, so all decorations share one base icon.
export const decorationIcon = () => find('misc/decoration')
export const charmIcon = () => find('misc/charm')
