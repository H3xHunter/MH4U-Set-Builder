import { GameIcon, type IconScale } from '@/components/GameIcon'
import { ARMOR_SLOTS, DECORATION_COLORS } from '@/data/types'
import { WEAPON_CLASSES } from '@/lib/icons'

const SCALES: IconScale[] = [0.5, 1, 2, 3]
const RARITIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="flex flex-wrap items-end gap-3">{children}</div>
    </section>
  )
}

function Everything() {
  return (
    <div className="space-y-6 p-4">
      {SCALES.map((scale) => (
        <div key={scale} className="space-y-4">
          <h2 className="text-lg font-bold">Scale {scale}</h2>
          <Section title="Armor (rarity 7)">
            {ARMOR_SLOTS.map((slot) => (
              <GameIcon key={slot} kind="armor" slot={slot} rarity={7} scale={scale} />
            ))}
          </Section>
          <Section title="Weapons (rarity 7)">
            {WEAPON_CLASSES.map((weaponClass) => (
              <GameIcon key={weaponClass} kind="weapon" weaponClass={weaponClass} rarity={7} scale={scale} />
            ))}
          </Section>
          <Section title="Decorations">
            {DECORATION_COLORS.map((color) => (
              <GameIcon key={color} kind="decoration" color={color} scale={scale} />
            ))}
          </Section>
          <Section title="Charm">
            <GameIcon kind="charm" scale={scale} />
          </Section>
        </div>
      ))}
    </div>
  )
}

export default function IconGallery() {
  return (
    <div className="min-h-screen">
      <h1 className="p-4 text-2xl font-bold">Icon gallery (dev only)</h1>
      <div className="grid md:grid-cols-2">
        <div className="bg-neutral-900 text-white">
          <Everything />
        </div>
        <div className="bg-white text-black">
          <Everything />
        </div>
      </div>
      <div className="space-y-4 p-4">
        <h2 className="text-lg font-bold">All rarity tints per armor slot (scale 2)</h2>
        {ARMOR_SLOTS.map((slot) => (
          <div key={slot} className="flex flex-wrap items-center gap-2">
            <span className="w-14 text-sm">{slot}</span>
            {RARITIES.map((rarity) => (
              <GameIcon key={rarity} kind="armor" slot={slot} rarity={rarity} scale={2} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
