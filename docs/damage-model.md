# Damage model (slice 1)

Effective raw (EFR) and effective element (EFE) of a build. They depend only on the build, never on motion values or
monster hitzones. Code: `src/lib/damage.ts` (logic), `src/lib/damageTables.ts` (numbers), `src/state/damage.ts` (adapter).

**Source of every number and formula here: the project owner, from MH4U in-game knowledge. Not from the database.**
The only values read from the data are the weapon's own fields (`attack`, `affinity`, `affinityOptions`, `element`,
`element2`, `awaken`, `sharpness`, `class`) and the skill point totals of the build.

Blademasters only. A gunner gets no result (`ok: false`, with a reason). A blademaster whose weapon has no usable
sharpness (horn 7324, whose source text is malformed) also gets `ok: false`.

## Raw

- `trueRaw = attack / classMultiplier`. The data's `attack` is the displayed value; it divides exactly for all 2324
  weapons (a test checks this in integer arithmetic).
- Class multipliers: Switch Axe 5.4; Hammer and Hunting Horn 5.2; Great Sword 4.8; Charge Blade 3.6; Long Sword 3.3;
  Insect Glaive 3.1; Lance and Gunlance 2.3; Heavy Bowgun 1.5; Sword and Shield and Dual Blades 1.4; Light Bowgun 1.3; Bow 1.2.
- Percent groups multiply, then flat groups add: `rawBeforeSong = trueRaw * product(1 + p) + sum(flat)`.
- Inside a group the best positive value wins; a negative tier always applies on top (best positive + worst negative).
- Raw flat groups: **G1** Attack (tree 31: -20/-15/-10 give -20/-15/-10; 10/15/20/25 give +10/+15/+20/+25) and
  Edgemaster (tree 2, 10 points: +20); **G2** Powercharm +6 (toggle); **G3** Powertalon +9 (toggle);
  **G4** Challenger (tree 26: 10 points +10, 15 points +25), only while "raged monster" is on.
- Raw percent group: kinsect buffs, Insect Glaive only. Red + White + Orange = +25%; else Red + White = +20%; else nothing.
- Horn songs, Hunting Horn only, encore always assumed: Attack Up S +15% and Attack Up L +20% (best wins),
  Affinity Up +20 points, Element Up +20%.
- `EFR = rawBeforeSong * (1 + songAttack) * sharpnessRaw * critFactor`. The displayed value is `EFR * classMultiplier`.

## Affinity and crit

- Base: the weapon's `affinity`; a double-affinity weapon (`affinityOptions [a, b]`) uses `(a + b) / 2`.
- Groups (percentage points): Expert (tree 37: -20/-15/-10/+10/+15/+20/+30) and Brutality (tree 10, 10 points: +15) share
  one group (best positive wins); Challenger (tree 26: 10 points +10, 15 points +20, raged only) is its own group;
  horn Affinity Up (+20) is its own group.
- `affinity = clamp(base + groups, -100, 100)`. `A >= 0`: `crit = 1 + 0.25 * A`. `A < 0`: `crit = 1 - 0.25 * |A|`.
  (Crit damage is always x1.25; no skill changes it.) `A` is the fraction, so 30 points is 0.30.

## Sharpness

- Raw multipliers by color (red, orange, yellow, green, blue, white, purple): 0.50, 0.75, 1.00, 1.05, 1.20, 1.32, 1.45.
- Element multipliers: 0.25, 0.50, 0.75, 1.00, 1.0625, 1.125, 1.20.
- The `plus` bar is used when Handicraft (tree 19) or Edgemaster (tree 2) is at 10 points; otherwise `base`.
- Selectable colors: those with points > 0 in the active bar. The default (and the fallback for an invalid choice) is the highest.

## Element

- Each element instance (`element`, `element2`) is separate. The shown value is the data value (true element x10).
- An `awaken` element counts only with Awaken (tree 17) or Enlightened Blade (tree 140) at 10 points.
- Percent group (best positive wins, a negative divides): Elemental (tree 84: +10% / -10%), Amplify (tree 14, 10 points: +10%),
  Arcana (tree 140, 10 points: +10%).
- (Ele) Atk trees 79 Fire, 80 Water, 81 Thunder, 82 Ice, 83 Dragon, only for an instance of the same type:
  10 points x1.05 +40; 15 x1.10 +60; 20 x1.15 +90; -10 is the exact inverse of the 10 tier (divide by 1.05, subtract 40).
- `EFE = max(0, shown * percentFactor * eleMult + eleFlat) * (1 + songElement) * sharpnessElement`.

## Weakness Exploit

Tenderizer (tree 29) or Brutality (tree 10) at 10 points sets `weaknessExploit: true`. It changes no number.

## Assumptions (not confirmed by the owner)

1. Affinity is clamped to [-100, 100] points.
2. The element percent groups and the (Ele) Atk multiplier multiply together.
3. A negative tier inside a group applies on top of the best positive one. For the element percent group a negative
   tier divides by its factor, so Amplify +10% with Elemental -10% cancels exactly.
4. Songs are not restricted by horn notes: every toggled song applies to any Hunting Horn.
5. The percent element group and songs apply to every element instance, including statuses (Poison, Paralysis and so on).
   Whether they do in the game is not stated.
6. Element damage is floored at 0 (a negative (Ele) Atk tier on a very low element value could otherwise go negative).
7. The default sharpness color is the highest one; the real gauge position is a user choice.
