// Exact `class` strings used in weapons.json (the data types `class` as a plain string).
export const BLADEMASTER_CLASSES = [
  'Great Sword',
  'Long Sword',
  'Sword and Shield',
  'Dual Blades',
  'Hammer',
  'Hunting Horn',
  'Lance',
  'Gunlance',
  'Switch Axe',
  'Charge Blade',
  'Insect Glaive',
] as const
export const GUNNER_CLASSES = ['Light Bowgun', 'Heavy Bowgun', 'Bow'] as const

export const WEAPON_CLASSES = [...BLADEMASTER_CLASSES, ...GUNNER_CLASSES] as const
export type WeaponClass = (typeof WEAPON_CLASSES)[number]

/** Hunter type a weapon class belongs to; null for a string that is not a known class. */
export function hunterTypeOfClass(weaponClass: string): 'blade' | 'gunner' | null {
  if ((BLADEMASTER_CLASSES as readonly string[]).includes(weaponClass)) return 'blade'
  if ((GUNNER_CLASSES as readonly string[]).includes(weaponClass)) return 'gunner'
  return null
}
