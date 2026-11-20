import {
  Activity, Baby, Banknote, BookOpen, BriefcaseMedical, Bus, Cake, Car, Cat,
  CircleDollarSign, CircleHelp, Coffee, CreditCard, Dog, Droplets, Dumbbell,
  Film, Fuel, Gamepad2, Gift, GraduationCap, HandCoins, Heart, House,
  Landmark, Music, Package, Palmtree, PawPrint, PiggyBank, Plane, Receipt,
  Shield, Shirt, ShoppingCart, Smartphone, Sparkles, Utensils, Wallet,
  WashingMachine, Wifi, Wrench, Zap,
  type LucideIcon,
} from 'lucide-react'
import { colors, envelopeColors } from '@/lib/tokens'

const PALETTE = [
  { name: 'Blue', color: envelopeColors[0] },
  { name: 'Indigo', color: envelopeColors[1] },
  { name: 'Violet', color: envelopeColors[2] },
  { name: 'Pink', color: envelopeColors[3] },
  { name: 'Orange', color: envelopeColors[4] },
  { name: 'Amber', color: envelopeColors[5] },
  { name: 'Lime', color: envelopeColors[6] },
  { name: 'Green', color: envelopeColors[7] },
  { name: 'Teal', color: envelopeColors[8] },
  { name: 'Brown', color: envelopeColors[9] },
  { name: 'Slate', color: envelopeColors[10] },
  { name: 'Gold', color: envelopeColors[11] },
]

const ICONS: { name: string; Icon: LucideIcon }[] = [
  { name: 'Home', Icon: House }, { name: 'Groceries', Icon: ShoppingCart },
  { name: 'Bus', Icon: Bus }, { name: 'Car', Icon: Car }, { name: 'Fuel', Icon: Fuel },
  { name: 'Wi-Fi', Icon: Wifi }, { name: 'Phone', Icon: Smartphone }, { name: 'Power', Icon: Zap },
  { name: 'Water', Icon: Droplets }, { name: 'School', Icon: GraduationCap }, { name: 'Books', Icon: BookOpen },
  { name: 'Family', Icon: Heart }, { name: 'Gift', Icon: Gift }, { name: 'Health', Icon: BriefcaseMedical },
  { name: 'Medicine', Icon: Activity }, { name: 'Savings', Icon: PiggyBank }, { name: 'Emergency', Icon: Shield },
  { name: 'Rainy day', Icon: CircleHelp }, { name: 'Travel', Icon: Plane }, { name: 'Holiday', Icon: Palmtree },
  { name: 'Repairs', Icon: Wrench }, { name: 'Clothing', Icon: Shirt }, { name: 'Baby', Icon: Baby },
  { name: 'Dog', Icon: Dog }, { name: 'Cat', Icon: Cat }, { name: 'Fitness', Icon: Dumbbell },
  { name: 'Music', Icon: Music }, { name: 'Movies', Icon: Film }, { name: 'Games', Icon: Gamepad2 },
  { name: 'Coffee', Icon: Coffee }, { name: 'Meals', Icon: Utensils }, { name: 'Shopping', Icon: Package },
  { name: 'Invoice', Icon: Receipt }, { name: 'Credit', Icon: CreditCard }, { name: 'Money', Icon: Banknote },
  { name: 'Bank', Icon: Landmark }, { name: 'Contribute', Icon: HandCoins }, { name: 'Wallet', Icon: Wallet },
  { name: 'Home care', Icon: WashingMachine }, { name: 'Celebration', Icon: Cake }, { name: 'Goals', Icon: Sparkles },
  { name: 'Giving', Icon: CircleDollarSign }, { name: 'Pets', Icon: PawPrint },
]

export function envelopeGroupDefaults(group: string) {
  if (group === 'debt') return { color: colors.danger, icon: 'credit' }
  if (group === 'education') return { color: envelopeColors[2], icon: 'books' }
  if (group === 'emergency') return { color: envelopeColors[7], icon: 'emergency' }
  if (group === 'goals') return { color: envelopeColors[5], icon: 'goals' }
  if (group === 'family') return { color: envelopeColors[3], icon: 'heart' }
  if (group === 'giving') return { color: envelopeColors[11], icon: 'gift' }
  if (group === 'personal') return { color: envelopeColors[1], icon: 'wallet' }
  if (group === 'system') return { color: envelopeColors[11], icon: 'wallet' }
  if (group === 'other') return { color: envelopeColors[10], icon: 'package' }
  return { color: envelopeColors[0], icon: 'home' }
}

const ICON_BY_KEY = Object.fromEntries(ICONS.map(({ name, Icon }) => [name.toLowerCase().split(' ').join('-'), Icon])) as Record<string, LucideIcon>
const ICON_ALIASES: Record<string, LucideIcon> = {
  home: House, house: House, rent: House, food: ShoppingCart, cart: ShoppingCart,
  'book-open': BookOpen, 'shopping-cart': ShoppingCart, bus: Bus, bolt: Zap,
  heart: Heart, gift: Gift, shield: Shield, sparkles: Sparkles, wallet: Wallet,
  'piggy-bank': PiggyBank, 'credit-card': CreditCard, 'circle-dollar-sign': CircleDollarSign,
}

export function getEnvelopeIcon(icon: string): LucideIcon {
  return ICON_BY_KEY[icon] ?? ICON_ALIASES[icon] ?? CircleHelp
}

export function EnvelopeIdentityPicker({
  color,
  icon,
  onColorChange,
  onIconChange,
  debtLocked = false,
}: {
  color: string
  icon: string
  onColorChange: (value: string) => void
  onIconChange: (value: string) => void
  debtLocked?: boolean
}) {
  return (
    <div className="identity-picker">
      <fieldset className="identity-fieldset">
        <legend>Envelope colour</legend>
        <div className="identity-palette">
          {PALETTE.map(({ name, color: value }) => (
            <button
              key={name}
              type="button"
              className={`identity-colour${color === value ? ' is-selected' : ''}`}
              style={{ '--swatch': value } as React.CSSProperties}
              aria-label={`${name}${color === value ? ', selected' : ''}`}
              aria-pressed={color === value}
              disabled={debtLocked}
              onClick={() => onColorChange(value)}
            />
          ))}
          <p className="identity-selected">Selected colour: {PALETTE.find(option => option.color === color)?.name ?? 'Debt red'}</p>
          {debtLocked && <p className="identity-hint">Debt envelopes use red so they are easy to recognize.</p>}
        </div>
      </fieldset>
      <fieldset className="identity-fieldset">
        <legend>Envelope icon</legend>
        <div className="identity-icons">
          {ICONS.map(({ name, Icon }) => {
            const value = name.toLowerCase().split(' ').join('-')
            const selected = icon === value
            return (
              <button
                key={name}
                type="button"
                className={`identity-icon${selected ? ' is-selected' : ''}`}
                aria-label={`${name}${selected ? ', selected' : ''}`}
                aria-pressed={selected}
                title={name}
                onClick={() => onIconChange(value)}
              ><Icon size={20} strokeWidth={2} /></button>
            )
          })}
        </div>
        <p className="identity-selected">Selected icon: {ICONS.find(option => option.name.toLowerCase().split(' ').join('-') === icon)?.name ?? 'Custom'}</p>
      </fieldset>
    </div>
  )
}
