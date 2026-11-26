# Damage model

Effective raw (EFR), effective element and effective status of a build. They depend only on the build, never on motion
values or monster hitzones. Code: `src/lib/damage.ts` (formula), `src/lib/buffRegistry.ts` (every buff),
`src/lib/damageTables.ts` (class and sharpness numbers), `src/state/damage.ts` (adapter).

**Source of every number and formula here: the project owner, from MH4U in-game knowledge. Not from the database.**
The only values read from the data are the weapon's own fields (`attack`, `affinity`, `affinityOptions`, `element`,
`element2`, `awaken`, `sharpness`, `class`) and the skill point totals of the build.

Blademasters only. A gunner gets no result (`ok: false`, with a reason). A blademaster whose weapon has no usable
sharpness (horn 7324, whose source text is malformed) also gets `ok: false`.

## The buff registry

Every buff is one entry of `BUFFS` in `buffRegistry.ts`; `calculateDamage` only collects the active effects, groups them
and combines them by type. `calculateDamage(input, registry = BUFFS)` takes the registry as an argument so a test can
inject a fake buff.

A buff: `id`, `label`, `source` (`skill`, `item`, `song`, `kinsect`), availability (`skill: {tree, tiers}` and/or
`classes`), an optional `toggle: {default, condition?}`, and `effects`. An effect: `type`, `group`, `value`, optional
`element` (applies to one element type only) and optional `needs` (other buff ids that must be active).

- **Available** means the weapon class fits and the skill's total points reach one of its tiers. Items are always available.
- **Active** means available and, if the buff has a toggle, switched on (a missing id uses the default). A buff without a
  toggle is always on while available.
- **Every skill buff has a toggle, default on**, so a skill can be switched off in the calculation only (the build does not
  change). A skill that is switched off contributes none of its effects, flags included: Handicraft or Edgemaster off means
  the base sharpness bar; Tenderizer or Brutality off removes the weakness-exploit flag; Awaken off locks the awaken element.
- **Defaults:** Powercharm and Powertalon on (players always carry them), every skill on, Challenger (raged monster) on, songs
  and kinsect buffs on. Any other item would default off.
- A skill effect's `value` is per positive tier. A negative tier `-n` uses the value of tier `n` inverted: negated for an
  add type, divided for a mult type (percent `p` is the factor `1 + p/100`). Negative tiers are never written as separate numbers.
- **Groups:** inside a group (per effect type) the best positive value wins and the worst negative one still applies on top.
  Then add types sum their groups and mult types multiply them.
- **Ids are a storage format** (toggle states will be saved by id): they match `/^[a-z0-9:_.-]{1,64}$/` and must never be
  renamed or reused.

### Effect types, in formula order

| Type | Kind | Where it applies |
|---|---|---|
| `rawPercent` | mult (percent) | multiplies true raw |
| `rawFlat` | add | added to raw, after `rawPercent` |
| `songRaw` | mult (percent) | final raw multiplier |
| `affinityAdd` | add (points) | added to the weapon's base affinity |
| `elementPercent` | mult (percent) | multiplies an element value |
| `elementMult` | mult (percent) | multiplies an element value ((Ele) Atk) |
| `elementFlat` | add | added to an element value, after the multipliers |
| `songElement` | mult (percent) | final element multiplier |
| `statusPercent` | mult (percent) | multiplies a status value (nothing else touches it) |
| `awaken`, `sharpnessPlus`, `weaknessExploit` | flag | no value |

Defense types will be added later: add the type to `EFFECT_TYPES` and use it in `damage.ts`.

### How to add a buff

Add one entry to `BUFFS`: pick an `id`, a `source`, availability, a `toggle` if the player can switch it, and its effects
with their types and group ids. Reuse a group id to share a best-wins group with existing buffs. No formula code changes.
Add a test that the skill tree and tiers exist (the registry integrity test does this for every skill buff).

`listToggles(weapon, skillTotals, registry)` returns the toggleable buffs to show for a build, by source. `parseToggles`
reads a stored id-to-boolean map: it accepts only a plain object, keeps only registry ids with boolean values, drops the rest
and never throws.

## The cards

Session-only state (toggle overrides over the registry defaults, and the chosen sharpness color); nothing is stored yet.
The chosen color belongs to the weapon it was chosen for (a new weapon starts at the top color) and falls back to the top
color for good if the active bar no longer has it (Handicraft switched off).

- **Damage card:** EFR (true value large, in-game value beside it, one decimal everywhere), one row per element or status
  instance ("Effective element: Fire", "Effective status: Poison" with the note that a higher value means faster buildup, not
  more damage), the breakdown (true raw, raw after buffs, affinity, crit factor, sharpness with its multipliers), the sharpness
  selector, and the Weakness Exploit note when the flag is set. Multipliers show their exact digits (x1.075). A result that
  is not available shows its reason and the true raw if it can be computed.
- **Buffs card:** an "Attack" section with Skills (the ones the build provides, named by the tier reached), Items, Songs
  (Hunting Horn; the note says songs are not yet limited to the horn's notes) and Kinsect (Insect Glaive; the active combination
  as text). "Reset buffs" returns every toggle to its default. A Defense section is added later next to Attack.
- **Mobile summary:** EFR and EFE (the shown value of each instance, "Status " before a status value, " / " between two,
  an en dash when unavailable) next to the defense total.

## Raw

- `trueRaw = attack / classMultiplier`. The data's `attack` is the displayed value; it divides exactly for all 2324
  weapons (a test checks this in integer arithmetic).
- Class multipliers: Switch Axe 5.4; Hammer and Hunting Horn 5.2; Great Sword 4.8; Charge Blade 3.6; Long Sword 3.3;
  Insect Glaive 3.1; Lance and Gunlance 2.3; Heavy Bowgun 1.5; Sword and Shield and Dual Blades 1.4; Light Bowgun 1.3; Bow 1.2.
- `rawBeforeSong = trueRaw * rawPercent + rawFlat`. The card's "raw after buffs" is `rawBeforeSong * songRaw`.
- `EFR = rawBeforeSong * songRaw * sharpnessRaw * critFactor`. The displayed value is `EFR * classMultiplier`.
- Raw flat groups: Attack (tree 31: -20/-15/-10 give -20/-15/-10; 10/15/20/25 give +10/+15/+20/+25) and Edgemaster (tree 2,
  10 points: +20) share one group; Powercharm +6 and Powertalon +9 (toggles, on by default); Challenger (tree 26: 10 points
  +10, 15 points +25) while "Raged monster" is on.
- Kinsect (Insect Glaive only; Red, White, Orange toggles, default on): all three ("Triple Up") +25%; else Red + White +20%; else nothing.
- Horn songs (Hunting Horn only, encore always assumed): Attack Up S +15% and L +20% (best wins), Affinity Up +20 points, Element Up +20%.

## Affinity and crit

- Base: the weapon's `affinity`; a double-affinity weapon (`affinityOptions [a, b]`) uses `(a + b) / 2`.
- Groups (percentage points): Expert (tree 37: -20/-15/-10/+10/+15/+20/+30) and Brutality (tree 10, 10 points: +15) share one
  group; Challenger (tree 26: 10 points +10, 15 points +20, raged only) is its own group; horn Affinity Up (+20) is its own group.
- `affinity = clamp(base + groups, -100, 100)`. `A >= 0`: `crit = 1 + 0.25 * A`. `A < 0`: `crit = 1 - 0.25 * |A|`.
  (Crit damage is always x1.25; no skill changes it.) `A` is the fraction, so 30 points is 0.30.

## Sharpness

- Raw multipliers by color (red, orange, yellow, green, blue, white, purple): 0.50, 0.75, 1.00, 1.05, 1.20, 1.32, 1.45.
- Element multipliers: 0.25, 0.50, 0.75, 1.00, 1.0625, 1.125, 1.20.
- The `plus` bar is used when the `sharpnessPlus` flag is active (Handicraft tree 19 or Edgemaster tree 2 at 10 points); else `base`.
- Selectable colors: those with points > 0 in the active bar. The default (and the fallback for an invalid choice) is the highest.

## Element and status instances

The weapon's `element`, `element2` and (when unlocked) `awaken` are separate instances. The exact `type` strings in
`weapons.json` decide the kind. A type in neither list is left out of the result.

- **Element** (Fire, Water, Thunder, Ice, Dragon): `effective = max(0, shown * elementPercent * elementMult + elementFlat) *
  songElement * sharpnessElement`. `shown` is the data value (true element x10).
  - `elementPercent` group (best wins, a negative divides): Elemental (tree 84: +10% / -10%), Amplify (tree 14, 10 points: +10%),
    Arcana (tree 140, 10 points: +10%).
  - (Ele) Atk trees 79 Fire, 80 Water, 81 Thunder, 82 Ice, 83 Dragon, only for an instance of the same type:
    10 points x1.05 +40; 15 x1.10 +60; 20 x1.15 +90; -10 is the inverse of the 10 tier (divide by 1.05, subtract 40).
- **Status** (Poison, Paralysis, Sleep, Blastblight): `effective = shown * statusPercent`. Nothing else applies: no
  sharpness, no songs, no Elemental, Amplify or (Ele) Atk. A higher value means faster buildup, not more damage.
  - `statusPercent` group (best wins): Status (tree 48: 10 points +12.5%, 15 points +25%, -10 divides by 1.125) and Enlightened
    Blade (tree 140, 10 points: +10%, same group). **The 12.5% and 25% values come from the owner.**
- An `awaken` element counts only with the `awaken` flag (Awaken tree 17 or Enlightened Blade tree 140 at 10 points).

## Weakness Exploit

Tenderizer (tree 29) or Brutality (tree 10) at 10 points sets the `weaknessExploit` flag. It changes no number.

## Pending

- **Status Crit (tree 131)** is not modeled: it needs values from the owner, including how it relates to affinity.
- **Gloves Off (tree 25)** and the other skills whose descriptions give no numbers are not modeled.

## Assumptions (not confirmed by the owner)

1. Affinity is clamped to [-100, 100] points.
2. The element percent group and the (Ele) Atk multiplier multiply together.
3. A negative tier inside a group applies on top of the best positive one. For a mult group a negative tier divides, so
   Amplify +10% with Elemental -10% cancels exactly.
4. Songs are not restricted by horn notes: every toggled song applies to any Hunting Horn.
5. Element damage is floored at 0 (a negative (Ele) Atk tier on a very low element value could otherwise go negative).
6. The default sharpness color is the highest one; the real gauge position is a user choice.
7. Gunners get no result, elements included.
8. Kinsect combinations other than Red + White + Orange and Red + White give nothing (for example Orange alone).
