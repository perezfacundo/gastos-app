import {
  Baby,
  Briefcase,
  Bus,
  Car,
  Clapperboard,
  Coffee,
  Dumbbell,
  Gift,
  GraduationCap,
  HandCoins,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  Music,
  Package,
  PawPrint,
  PiggyBank,
  Plane,
  Receipt,
  ShieldCheck,
  Shirt,
  ShoppingCart,
  Smartphone,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react"

import { colorVar } from "@/lib/finance/config"
import type { CategoryColor } from "@/lib/finance/types"
import { cn } from "@/lib/utils"

/** Registro de íconos seleccionables. Se guarda la clave (string) en localStorage. */
export const ICONS: Record<string, LucideIcon> = {
  house: House,
  cart: ShoppingCart,
  bus: Bus,
  car: Car,
  zap: Zap,
  wifi: Wifi,
  heart: HeartPulse,
  dumbbell: Dumbbell,
  clapperboard: Clapperboard,
  music: Music,
  coffee: Coffee,
  shirt: Shirt,
  graduation: GraduationCap,
  baby: Baby,
  paw: PawPrint,
  smartphone: Smartphone,
  gift: Gift,
  receipt: Receipt,
  package: Package,
  briefcase: Briefcase,
  laptop: Laptop,
  coins: HandCoins,
  landmark: Landmark,
  piggy: PiggyBank,
  shield: ShieldCheck,
  plane: Plane,
}

export const ICON_KEYS = Object.keys(ICONS)

const SIZES = {
  sm: { box: "size-7 rounded-md", icon: "size-3.5" },
  md: { box: "size-9 rounded-lg", icon: "size-4" },
  lg: { box: "size-11 rounded-xl", icon: "size-5" },
} as const

interface IconChipProps {
  icon: string
  color: CategoryColor
  size?: keyof typeof SIZES
  className?: string
}

/** Ícono sobre un fondo tenue del color de la categoría/meta. */
export function IconChip({ icon, color, size = "md", className }: IconChipProps) {
  const Icon = ICONS[icon] ?? Package
  const s = SIZES[size]
  return (
    <span
      aria-hidden="true"
      className={cn("grid shrink-0 place-items-center", s.box, className)}
      style={{
        color: colorVar(color),
        backgroundColor: `color-mix(in oklch, ${colorVar(color)} 14%, transparent)`,
      }}
    >
      <Icon className={s.icon} strokeWidth={2.2} />
    </span>
  )
}

/** Punto de color + nombre, para leyendas y metadatos compactos. */
export function ColorDot({ color, className }: { color: CategoryColor; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: colorVar(color) }}
    />
  )
}
