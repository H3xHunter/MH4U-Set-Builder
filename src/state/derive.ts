import { ARMOR_SLOTS, type Armor, type ArmorSlot, type Weapon } from '@/data/types'
import { computeSkills, type SkillInput, type SkillRow } from '@/lib/skills'
import { slotUsage, type SlotUsage } from '@/lib/slots'
import {
  capacityOf,
  decosOf,
  findArmor,
  findDeco,
  resolveCharm,
  resolveWeapon,
  type BuildContext,
  type BuildState,
  type Target,
} from './build'

export interface Resistances {
  fire: number
  water: number
  thunder: number
  ice: number
  dragon: number
}

export interface DerivedBuild {
  weapon: Weapon | null
  slotUsage: { weapon: SlotUsage; charm: SlotUsage; armor: Record<ArmorSlot, SlotUsage> }
  skillInput: SkillInput
  skills: SkillRow[]
  /** Sum over worn pieces of `defense`, or of `maxDefense` when armorLevel is 'max' (see fallback below). */
  armorDefense: number
  /** The weapon's `defenseBonus`. UNVERIFIED whether it belongs in the in-game defense total. */
  weaponDefenseBonus: number
  /** armorDefense + weaponDefenseBonus. Counting the weapon bonus is UNVERIFIED. */
  totalDefense: number
  /** In 'max' mode, how many worn pieces had maxDefense null and used `defense` instead (always 0 in 'normal'). */
  maxDefenseFallbackCount: number
  resistances: Resistances
}

export function deriveBuild(state: BuildState, ctx: BuildContext): DerivedBuild {
  const usage = (t: Target) => slotUsage(capacityOf(state, t, ctx), decosOf(state, t).flatMap((id) => findDeco(ctx, id) ?? []))
  const decorations = (t: Target) => decosOf(state, t).flatMap((id) => findDeco(ctx, id) ?? [])

  const worn: Armor[] = []
  const pieces: SkillInput['pieces'] = {}
  for (const slot of ARMOR_SLOTS) {
    const sel = state.armor[slot]
    const armor = sel && findArmor(ctx, sel.armorId)
    if (!armor) continue
    worn.push(armor)
    pieces[slot] = { armor, decorations: decorations({ kind: 'armor', slot }) }
  }

  const charm = resolveCharm(state, ctx)
  const skillInput: SkillInput = {
    pieces,
    charm: charm && { skills: charm.skills, decorations: decorations({ kind: 'charm' }) },
    weaponDecorations: decorations({ kind: 'weapon' }),
  }

  // ASSUMPTION: the meaning of a null maxDefense is unknown, so in 'max' mode such a piece
  // falls back to its normal defense. Counted in maxDefenseFallbackCount so the UI can flag it.
  let maxDefenseFallbackCount = 0
  let armorDefense = 0
  for (const a of worn) {
    if (state.armorLevel === 'max' && a.maxDefense === null) maxDefenseFallbackCount++
    armorDefense += state.armorLevel === 'max' ? (a.maxDefense ?? a.defense) : a.defense
  }

  const weapon = resolveWeapon(state, ctx)
  const weaponDefenseBonus = weapon?.defenseBonus ?? 0 // `?? 0`: null would mean no bonus
  const resistances: Resistances = { fire: 0, water: 0, thunder: 0, ice: 0, dragon: 0 }
  for (const a of worn) for (const k of Object.keys(resistances) as (keyof Resistances)[]) resistances[k] += a.res[k]

  return {
    weapon,
    slotUsage: {
      weapon: usage({ kind: 'weapon' }),
      charm: usage({ kind: 'charm' }),
      armor: Object.fromEntries(ARMOR_SLOTS.map((slot) => [slot, usage({ kind: 'armor', slot })])) as Record<ArmorSlot, SlotUsage>,
    },
    skillInput,
    skills: computeSkills(skillInput, ctx.data.skills),
    armorDefense,
    weaponDefenseBonus,
    totalDefense: armorDefense + weaponDefenseBonus,
    maxDefenseFallbackCount,
    resistances,
  }
}
