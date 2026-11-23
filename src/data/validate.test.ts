import { describe, expect, it } from 'vitest'
import { DataValidationError, validateGameData } from './validate'

// Loose on purpose: tests mutate the fixture freely.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fx = Record<string, any>

const fixture = (): Fx => ({
  meta: {
    dataVersion: 1,
    sourceUrl: 'u',
    sourceCommit: 'c',
    dbSha256: 'h',
    license: 'l',
    torsoUpTreeId: 9,
    counts: { armor: 1 },
  },
  skills: [
    {
      id: 1,
      name: 'Attack',
      tiers: [
        { points: -10, name: 'n', description: null },
        { points: 10, name: 'p', description: 'x' },
      ],
    },
  ],
  armor: [
    {
      id: 10,
      name: 'Cap',
      slot: 'head',
      hunterType: 'both',
      gender: null,
      slots: 2,
      defense: 1,
      maxDefense: null,
      res: { fire: 0, water: 0, thunder: 0, ice: 0, dragon: 0 },
      skills: { '1': 2 },
      torsoUp: false,
      rarity: 1,
      materials: [{ itemId: 100, quantity: 1, kind: 'create' }],
    },
  ],
  decorations: [{ id: 20, name: 'Jewel', size: 1, skills: { '1': 1 } }],
  weapons: [weapon(30, null), weapon(31, 30)],
  horn: [{ notes: 'WBR', song: 'W', effect1: 'e', effect2: 'f', duration: '1', extension: '2' }],
  materials: [
    {
      id: 100,
      name: 'Ore',
      rarity: 1,
      drops: [{ monsterId: 1, rank: 'LR', condition: 'c', percentage: null, stackSize: 1 }],
      gathering: [{ locationId: 1, area: 'a', site: 's', rank: 'HR', quantity: 1, percentage: 5 }],
      sources: {
        quests: [{ questId: 1, slot: 'A', percentage: 5, stackSize: 1 }],
        arena: [{ arenaQuestId: 1, percentage: 5, stackSize: 1 }],
        combining: [{ item1Id: 200, item2Id: 100, amountMin: 1, amountMax: 1, percentage: 5 }],
        veggieElder: [{ offerItemId: 200, quantity: 1 }],
        wyporium: [{ itemInId: 200, itemOutId: 100, unlockQuestId: null }],
      },
    },
  ],
  monsters: [{ id: 1, name: 'M', class: 'c', hitzones: [{ part: 'p', cut: 1, impact: 1, shot: 1, fire: 1, water: 1, ice: 1, thunder: 1, dragon: 1, ko: 1 }] }],
  locations: [{ id: 1, name: 'L' }],
  quests: [
    { id: 1, kind: 'quest', name: 'q', hub: 'Caravan', type: 'Key', stars: 1 },
    { id: 1, kind: 'arena', name: 'a', hub: null, type: null, stars: null },
  ],
  items: [{ id: 200, name: 'I', type: 't', rarity: 1 }],
})

function weapon(id: number, parentId: number | null) {
  return {
    id, name: 'W', class: 'Great Sword', parentId, final: false, rarity: 1, attack: 1, maxAttack: null,
    affinity: 0, affinityOptions: null, element: null, element2: null, awaken: null, defenseBonus: 0,
    sharpness: null, slots: 0, hornNotes: null,
    extra: { shellingType: null, phial: null, charges: null, coatings: null, recoil: null, reloadSpeed: null, rapidFire: null, deviation: null, ammo: null, specialAmmo: null },
  }
}

function pathOf(mutate: (d: Fx) => void): string | undefined {
  const d = fixture()
  mutate(d)
  try {
    validateGameData(d)
  } catch (e) {
    expect(e).toBeInstanceOf(DataValidationError)
    return (e as DataValidationError).path
  }
  return undefined
}

describe('validateGameData', () => {
  it('accepts valid data', () => {
    expect(validateGameData(fixture()).armor[0].id).toBe(10)
  })
  const cases: [string, (d: Fx) => void, string][] = [
    ['missing field', (d) => delete d.armor[0].name, 'armor[0].name'],
    ['missing file', (d) => delete d.items, 'items'],
    ['wrong type', (d) => (d.armor[0].torsoUp = 'no'), 'armor[0].torsoUp'],
    ['number where string expected', (d) => (d.armor[0].name = 5), 'armor[0].name'],
    ['unsorted tiers', (d) => d.skills[0].tiers.reverse(), 'skills[0].tiers[1].points'],
    ['duplicate tier threshold', (d) => (d.skills[0].tiers[1].points = -10), 'skills[0].tiers[1].points'],
    ['dangling tree id', (d) => (d.armor[0].skills = { '1': 1, '9': 1 }), 'armor[0].skills.9'],
    ['dangling tree id in decoration', (d) => (d.decorations[0].skills = { '7': 1 }), 'decorations[0].skills.7'],
    ['duplicate id', (d) => d.armor.push({ ...d.armor[0] }), 'armor[1].id'],
    ['duplicate quest (kind,id)', (d) => d.quests.push({ ...d.quests[0] }), 'quests[2].id'],
    ['non-integer slots', (d) => (d.armor[0].slots = 1.5), 'armor[0].slots'],
    ['slots of 4', (d) => (d.armor[0].slots = 4), 'armor[0].slots'],
    ['unknown enum', (d) => (d.armor[0].slot = 'feet'), 'armor[0].slot'],
    ['affinity and options both set', (d) => (d.weapons[0].affinityOptions = [1, 2]), 'weapons[0].affinity'],
    ['neither affinity nor options', (d) => (d.weapons[0].affinity = null), 'weapons[0].affinity'],
    ['dangling quest in material source', (d) => (d.materials[0].sources.quests[0].questId = 99), 'materials[0].sources.quests[0].questId'],
    ['arena ref resolved in arena id space', (d) => (d.quests[1].id = 2), 'materials[0].sources.arena[0].arenaQuestId'],
    ['dangling material item', (d) => (d.armor[0].materials[0].itemId = 5), 'armor[0].materials[0].itemId'],
    ['dangling drop monster', (d) => (d.materials[0].drops[0].monsterId = 5), 'materials[0].drops[0].monsterId'],
    ['dangling location', (d) => (d.materials[0].gathering[0].locationId = 5), 'materials[0].gathering[0].locationId'],
    ['dangling wyporium unlock quest', (d) => (d.materials[0].sources.wyporium[0].unlockQuestId = 5), 'materials[0].sources.wyporium[0].unlockQuestId'],
    ['dangling parent weapon', (d) => (d.weapons[1].parentId = 5), 'weapons[1].parentId'],
  ]
  it.each(cases)('%s', (_n, mutate, path) => expect(pathOf(mutate)).toBe(path))
})
