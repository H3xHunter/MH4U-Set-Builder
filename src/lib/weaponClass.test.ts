import { describe, expect, it } from 'vitest'
import { loadRealData } from '@/data/real-data-fixture'
import { BLADEMASTER_CLASSES, GUNNER_CLASSES, hunterTypeOfClass, WEAPON_CLASSES } from './weaponClass'

describe('weaponClass', () => {
  const data = loadRealData()

  it('lists exactly the 14 classes found in weapons.json', () => {
    expect(WEAPON_CLASSES).toHaveLength(14)
    expect([...new Set(data.weapons.map((w) => w.class))].sort()).toEqual([...WEAPON_CLASSES].sort())
  })

  it('maps every class to a hunter type: 11 blademaster, 3 gunner', () => {
    expect(BLADEMASTER_CLASSES).toHaveLength(11)
    expect(GUNNER_CLASSES).toHaveLength(3)
    for (const c of WEAPON_CLASSES) expect(hunterTypeOfClass(c)).not.toBeNull()
    expect(GUNNER_CLASSES.map(hunterTypeOfClass)).toEqual(['gunner', 'gunner', 'gunner'])
    expect(hunterTypeOfClass('Bow')).toBe('gunner')
    expect(hunterTypeOfClass('Hammer')).toBe('blade')
    expect(hunterTypeOfClass('Nonsense')).toBeNull()
  })
})
