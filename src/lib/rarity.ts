/** CSS color for rarity text (AA on cards); undefined for an out-of-range value so the text keeps its inherited color. */
export const rarityTextColor = (rarity: number): string | undefined =>
  Number.isInteger(rarity) && rarity >= 1 && rarity <= 10 ? `var(--rarity-text-${rarity})` : undefined

export const signed = (n: number): string => (n > 0 ? `+${n}` : String(n))
