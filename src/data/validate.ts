import {
  ARMOR_SLOTS,
  GENDERS,
  HUNTER_TYPES,
  MATERIAL_KINDS,
  QUEST_KINDS,
  RANKS,
  type Armor,
  type Decoration,
  type GameData,
  type Hitzone,
  type HornSong,
  type Item,
  type Location,
  type Material,
  type Meta,
  type Monster,
  type Quest,
  type SevenInts,
  type SkillPoints,
  type SkillTree,
  type Weapon,
  type WeaponElement,
} from './types'

export class DataValidationError extends Error {
  readonly path: string
  constructor(path: string, message: string) {
    super(`${path}: ${message}`)
    this.name = 'DataValidationError'
    this.path = path
  }
}

const fail = (path: string, msg: string): never => {
  throw new DataValidationError(path, msg)
}

type Obj = Record<string, unknown>
type Check<T> = (v: unknown, p: string) => T

const at = (p: string, i: number) => `${p}[${i}]`
const dot = (p: string, k: string) => (p ? `${p}.${k}` : k)

const obj: Check<Obj> = (v, p) =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Obj) : fail(p, 'expected an object')
const str: Check<string> = (v, p) => (typeof v === 'string' ? v : fail(p, 'expected a string'))
const bool: Check<boolean> = (v, p) => (typeof v === 'boolean' ? v : fail(p, 'expected a boolean'))
const num: Check<number> = (v, p) => (typeof v === 'number' && Number.isFinite(v) ? v : fail(p, 'expected a number'))
const int: Check<number> = (v, p) => (Number.isInteger(v) ? (v as number) : fail(p, 'expected an integer'))
const intIn =
  (lo: number, hi: number): Check<number> =>
  (v, p) => {
    const n = int(v, p)
    return n >= lo && n <= hi ? n : fail(p, `expected an integer from ${lo} to ${hi}`)
  }
const oneOf =
  <T extends string>(allowed: readonly T[]): Check<T> =>
  (v, p) =>
    typeof v === 'string' && (allowed as readonly string[]).includes(v)
      ? (v as T)
      : fail(p, `expected one of ${allowed.join(', ')}`)
const nullable =
  <T>(f: Check<T>): Check<T | null> =>
  (v, p) =>
    v === null ? null : f(v, p)
const arrOf =
  <T>(f: Check<T>): Check<T[]> =>
  (v, p) => (Array.isArray(v) ? v.map((x, i) => f(x, at(p, i))) : fail(p, 'expected an array'))

/** Reads field `k` of `o` (path `p`) with check `f`; a missing key is an error. */
const field = <T>(o: Obj, p: string, k: string, f: Check<T>): T => {
  if (!(k in o)) fail(dot(p, k), 'missing')
  return f(o[k], dot(p, k))
}

/** Object keyed by integer-like strings with integer values. */
const skillPoints: Check<SkillPoints> = (v, p) => {
  const o = obj(v, p)
  for (const k of Object.keys(o)) {
    if (!/^-?\d+$/.test(k)) fail(dot(p, k), 'expected an integer tree id key')
    int(o[k], dot(p, k))
  }
  return o as SkillPoints
}

const elementCheck: Check<WeaponElement> = (v, p) => {
  const o = obj(v, p)
  return { type: field(o, p, 'type', str), value: field(o, p, 'value', int) }
}

const sevenInts: Check<SevenInts> = (v, p) => {
  const a = arrOf(int)(v, p)
  return a.length === 7 ? (a as SevenInts) : fail(p, 'expected 7 integers')
}

function unique<T>(list: T[], name: string, key: (x: T) => string): void {
  const seen = new Set<string>()
  list.forEach((x, i) => {
    const k = key(x)
    if (seen.has(k)) fail(dot(at(name, i), 'id'), `duplicate id ${k}`)
    seen.add(k)
  })
}

const listOf = <T>(raw: Obj, name: string, f: Check<T>): T[] => {
  if (!(name in raw)) fail(name, 'missing')
  return arrOf(f)(raw[name], name)
}

const validateMeta: Check<Meta> = (v, p) => {
  const o = obj(v, p)
  const counts = field(o, p, 'counts', obj)
  for (const k of Object.keys(counts)) int(counts[k], dot(dot(p, 'counts'), k))
  return {
    dataVersion: field(o, p, 'dataVersion', int),
    sourceUrl: field(o, p, 'sourceUrl', str),
    sourceCommit: field(o, p, 'sourceCommit', str),
    dbSha256: field(o, p, 'dbSha256', str),
    license: field(o, p, 'license', str),
    torsoUpTreeId: field(o, p, 'torsoUpTreeId', int),
    counts: counts as Record<string, number>,
  }
}

const validateSkill: Check<SkillTree> = (v, p) => {
  const o = obj(v, p)
  const tiers = field(
    o,
    p,
    'tiers',
    arrOf((t, tp) => {
      const to = obj(t, tp)
      return {
        points: field(to, tp, 'points', int),
        name: field(to, tp, 'name', str),
        description: field(to, tp, 'description', nullable(str)),
      }
    }),
  )
  for (let i = 1; i < tiers.length; i++) {
    const pp = dot(at(dot(p, 'tiers'), i), 'points')
    if (tiers[i].points === tiers[i - 1].points) fail(pp, `duplicate threshold ${tiers[i].points}`)
    if (tiers[i].points < tiers[i - 1].points) fail(pp, 'tiers must be sorted ascending by points')
  }
  return { id: field(o, p, 'id', int), name: field(o, p, 'name', str), tiers }
}

const validateArmor: Check<Armor> = (v, p) => {
  const o = obj(v, p)
  const res = field(o, p, 'res', obj)
  const rp = dot(p, 'res')
  return {
    id: field(o, p, 'id', int),
    name: field(o, p, 'name', str),
    slot: field(o, p, 'slot', oneOf(ARMOR_SLOTS)),
    hunterType: field(o, p, 'hunterType', nullable(oneOf(HUNTER_TYPES))),
    gender: field(o, p, 'gender', nullable(oneOf(GENDERS))),
    slots: field(o, p, 'slots', intIn(0, 3)),
    defense: field(o, p, 'defense', int),
    maxDefense: field(o, p, 'maxDefense', nullable(int)),
    res: {
      fire: field(res, rp, 'fire', int),
      water: field(res, rp, 'water', int),
      thunder: field(res, rp, 'thunder', int),
      ice: field(res, rp, 'ice', int),
      dragon: field(res, rp, 'dragon', int),
    },
    skills: field(o, p, 'skills', skillPoints),
    torsoUp: field(o, p, 'torsoUp', bool),
    rarity: field(o, p, 'rarity', int),
    materials: field(
      o,
      p,
      'materials',
      arrOf((m, mp) => {
        const mo = obj(m, mp)
        return {
          itemId: field(mo, mp, 'itemId', int),
          quantity: field(mo, mp, 'quantity', int),
          kind: field(mo, mp, 'kind', oneOf(MATERIAL_KINDS)),
        }
      }),
    ),
  }
}

const validateDecoration: Check<Decoration> = (v, p) => {
  const o = obj(v, p)
  return {
    id: field(o, p, 'id', int),
    name: field(o, p, 'name', str),
    size: field(o, p, 'size', intIn(1, 3)),
    skills: field(o, p, 'skills', skillPoints),
  }
}

const EXTRA_KEYS = [
  'shellingType',
  'phial',
  'charges',
  'coatings',
  'recoil',
  'reloadSpeed',
  'rapidFire',
  'deviation',
  'ammo',
  'specialAmmo',
] as const

const validateWeapon: Check<Weapon> = (v, p) => {
  const o = obj(v, p)
  const affinity = field(o, p, 'affinity', nullable(int))
  const affinityOptions = field(
    o,
    p,
    'affinityOptions',
    nullable((a, ap) => {
      const xs = arrOf(int)(a, ap)
      return xs.length === 2 ? (xs as [number, number]) : fail(ap, 'expected [int, int]')
    }),
  )
  if ((affinity === null) === (affinityOptions === null)) {
    fail(dot(p, 'affinity'), 'affinity must be null exactly when affinityOptions is set')
  }
  const extraObj = field(o, p, 'extra', obj)
  const ep = dot(p, 'extra')
  const extra = Object.fromEntries(EXTRA_KEYS.map((k) => [k, field(extraObj, ep, k, nullable(str))]))
  return {
    id: field(o, p, 'id', int),
    name: field(o, p, 'name', str),
    class: field(o, p, 'class', str),
    parentId: field(o, p, 'parentId', nullable(int)),
    final: field(o, p, 'final', bool),
    rarity: field(o, p, 'rarity', int),
    attack: field(o, p, 'attack', int),
    maxAttack: field(o, p, 'maxAttack', nullable(int)),
    affinity,
    affinityOptions,
    element: field(o, p, 'element', nullable(elementCheck)),
    element2: field(o, p, 'element2', nullable(elementCheck)),
    awaken: field(o, p, 'awaken', nullable(elementCheck)),
    defenseBonus: field(o, p, 'defenseBonus', int),
    sharpness: field(
      o,
      p,
      'sharpness',
      nullable((s, sp) => {
        const so = obj(s, sp)
        return { base: field(so, sp, 'base', sevenInts), plus: field(so, sp, 'plus', sevenInts) }
      }),
    ),
    slots: field(o, p, 'slots', intIn(0, 3)),
    hornNotes: field(o, p, 'hornNotes', nullable(str)),
    extra: extra as Weapon['extra'],
  }
}

const validateHorn: Check<HornSong> = (v, p) => {
  const o = obj(v, p)
  return {
    notes: field(o, p, 'notes', str),
    song: field(o, p, 'song', str),
    effect1: field(o, p, 'effect1', str),
    effect2: field(o, p, 'effect2', str),
    duration: field(o, p, 'duration', str),
    extension: field(o, p, 'extension', str),
  }
}

const rec = <T>(shape: (o: Obj, p: string) => T): Check<T> => (v, p) => shape(obj(v, p), p)

const validateMaterial: Check<Material> = (v, p) => {
  const o = obj(v, p)
  const sp = dot(p, 'sources')
  const s = field(o, p, 'sources', obj)
  return {
    id: field(o, p, 'id', int),
    name: field(o, p, 'name', str),
    rarity: field(o, p, 'rarity', int),
    drops: field(
      o,
      p,
      'drops',
      arrOf(
        rec((d, dp) => ({
          monsterId: field(d, dp, 'monsterId', int),
          rank: field(d, dp, 'rank', oneOf(RANKS)),
          condition: field(d, dp, 'condition', str),
          percentage: field(d, dp, 'percentage', nullable(num)),
          stackSize: field(d, dp, 'stackSize', int),
        })),
      ),
    ),
    gathering: field(
      o,
      p,
      'gathering',
      arrOf(
        rec((g, gp) => ({
          locationId: field(g, gp, 'locationId', int),
          area: field(g, gp, 'area', str),
          site: field(g, gp, 'site', str),
          rank: field(g, gp, 'rank', oneOf(RANKS)),
          quantity: field(g, gp, 'quantity', int),
          percentage: field(g, gp, 'percentage', num),
        })),
      ),
    ),
    sources: {
      quests: field(
        s,
        sp,
        'quests',
        arrOf(
          rec((q, qp) => ({
            questId: field(q, qp, 'questId', int),
            slot: field(q, qp, 'slot', str),
            percentage: field(q, qp, 'percentage', num),
            stackSize: field(q, qp, 'stackSize', int),
          })),
        ),
      ),
      arena: field(
        s,
        sp,
        'arena',
        arrOf(
          rec((a, ap) => ({
            arenaQuestId: field(a, ap, 'arenaQuestId', int),
            percentage: field(a, ap, 'percentage', num),
            stackSize: field(a, ap, 'stackSize', int),
          })),
        ),
      ),
      combining: field(
        s,
        sp,
        'combining',
        arrOf(
          rec((c, cp) => ({
            item1Id: field(c, cp, 'item1Id', int),
            item2Id: field(c, cp, 'item2Id', int),
            amountMin: field(c, cp, 'amountMin', int),
            amountMax: field(c, cp, 'amountMax', int),
            percentage: field(c, cp, 'percentage', num),
          })),
        ),
      ),
      veggieElder: field(
        s,
        sp,
        'veggieElder',
        arrOf(
          rec((e, ep) => ({
            offerItemId: field(e, ep, 'offerItemId', int),
            quantity: field(e, ep, 'quantity', int),
          })),
        ),
      ),
      wyporium: field(
        s,
        sp,
        'wyporium',
        arrOf(
          rec((w, wp) => ({
            itemInId: field(w, wp, 'itemInId', int),
            itemOutId: field(w, wp, 'itemOutId', int),
            unlockQuestId: field(w, wp, 'unlockQuestId', nullable(int)),
          })),
        ),
      ),
    },
  }
}

const validateMonster: Check<Monster> = (v, p) => {
  const o = obj(v, p)
  return {
    id: field(o, p, 'id', int),
    name: field(o, p, 'name', str),
    class: field(o, p, 'class', str),
    hitzones: field(
      o,
      p,
      'hitzones',
      arrOf(
        rec(
          (h, hp): Hitzone => ({
            part: field(h, hp, 'part', str),
            cut: field(h, hp, 'cut', int),
            impact: field(h, hp, 'impact', int),
            shot: field(h, hp, 'shot', int),
            fire: field(h, hp, 'fire', int),
            water: field(h, hp, 'water', int),
            ice: field(h, hp, 'ice', int),
            thunder: field(h, hp, 'thunder', int),
            dragon: field(h, hp, 'dragon', int),
            ko: field(h, hp, 'ko', int),
          }),
        ),
      ),
    ),
  }
}

const validateLocation: Check<Location> = rec((o, p) => ({
  id: field(o, p, 'id', int),
  name: field(o, p, 'name', str),
}))

const validateQuest: Check<Quest> = rec((o, p) => ({
  id: field(o, p, 'id', int),
  kind: field(o, p, 'kind', oneOf(QUEST_KINDS)),
  name: field(o, p, 'name', str),
  hub: field(o, p, 'hub', nullable(str)),
  type: field(o, p, 'type', nullable(str)),
  stars: field(o, p, 'stars', nullable(int)),
}))

const validateItem: Check<Item> = rec((o, p) => ({
  id: field(o, p, 'id', int),
  name: field(o, p, 'name', str),
  type: field(o, p, 'type', str),
  rarity: field(o, p, 'rarity', int),
}))

/** Validates the parsed contents of public/data/*.json (keyed by file name without extension). */
export function validateGameData(raw: Record<string, unknown>): GameData {
  if (!('meta' in raw)) fail('meta', 'missing')
  const data: GameData = {
    meta: validateMeta(raw.meta, 'meta'),
    skills: listOf(raw, 'skills', validateSkill),
    armor: listOf(raw, 'armor', validateArmor),
    decorations: listOf(raw, 'decorations', validateDecoration),
    weapons: listOf(raw, 'weapons', validateWeapon),
    horn: listOf(raw, 'horn', validateHorn),
    materials: listOf(raw, 'materials', validateMaterial),
    monsters: listOf(raw, 'monsters', validateMonster),
    locations: listOf(raw, 'locations', validateLocation),
    quests: listOf(raw, 'quests', validateQuest),
    items: listOf(raw, 'items', validateItem),
  }

  const keyId = (x: { id: number }) => String(x.id)
  for (const name of ['skills', 'armor', 'decorations', 'weapons', 'materials', 'monsters', 'locations', 'items'] as const) {
    unique<{ id: number }>(data[name], name, keyId)
  }
  unique(data.quests, 'quests', (q) => `(${q.kind}, ${q.id})`)

  checkRefs(data)
  return data
}

function checkRefs(d: GameData): void {
  const ids = (xs: { id: number }[]) => new Set(xs.map((x) => x.id))
  const trees = ids(d.skills)
  const materials = ids(d.materials)
  const items = ids(d.items)
  const monsters = ids(d.monsters)
  const locations = ids(d.locations)
  const weapons = ids(d.weapons)
  const quests = ids(d.quests.filter((q) => q.kind === 'quest'))
  const arenas = ids(d.quests.filter((q) => q.kind === 'arena'))

  const need = (set: Set<number>, id: number, p: string, what: string) => {
    if (!set.has(id)) fail(p, `dangling ${what} id ${id}`)
  }
  const needTrees = (skills: SkillPoints, p: string) => {
    for (const k of Object.keys(skills)) if (!trees.has(Number(k))) fail(dot(p, k), `dangling skill tree id ${k}`)
  }
  const needItem = (id: number, p: string) => {
    if (!materials.has(id) && !items.has(id)) fail(p, `dangling item id ${id}`)
  }

  d.armor.forEach((a, i) => {
    const p = at('armor', i)
    needTrees(a.skills, dot(p, 'skills'))
    a.materials.forEach((m, j) => need(materials, m.itemId, dot(at(dot(p, 'materials'), j), 'itemId'), 'material item'))
  })
  d.decorations.forEach((x, i) => needTrees(x.skills, dot(at('decorations', i), 'skills')))
  d.weapons.forEach((w, i) => {
    if (w.parentId !== null) need(weapons, w.parentId, dot(at('weapons', i), 'parentId'), 'weapon')
  })
  d.materials.forEach((m, i) => {
    const p = at('materials', i)
    m.drops.forEach((x, j) => need(monsters, x.monsterId, dot(at(dot(p, 'drops'), j), 'monsterId'), 'monster'))
    m.gathering.forEach((x, j) =>
      need(locations, x.locationId, dot(at(dot(p, 'gathering'), j), 'locationId'), 'location'),
    )
    const sp = dot(p, 'sources')
    m.sources.quests.forEach((x, j) => need(quests, x.questId, dot(at(dot(sp, 'quests'), j), 'questId'), 'quest'))
    m.sources.arena.forEach((x, j) =>
      need(arenas, x.arenaQuestId, dot(at(dot(sp, 'arena'), j), 'arenaQuestId'), 'arena quest'),
    )
    m.sources.combining.forEach((x, j) => {
      const cp = at(dot(sp, 'combining'), j)
      needItem(x.item1Id, dot(cp, 'item1Id'))
      needItem(x.item2Id, dot(cp, 'item2Id'))
    })
    m.sources.veggieElder.forEach((x, j) => needItem(x.offerItemId, dot(at(dot(sp, 'veggieElder'), j), 'offerItemId')))
    m.sources.wyporium.forEach((x, j) => {
      const wp = at(dot(sp, 'wyporium'), j)
      needItem(x.itemInId, dot(wp, 'itemInId'))
      needItem(x.itemOutId, dot(wp, 'itemOutId'))
      if (x.unlockQuestId !== null) need(quests, x.unlockQuestId, dot(wp, 'unlockQuestId'), 'quest')
    })
  })
}
