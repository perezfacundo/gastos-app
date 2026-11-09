import type { CategoryColor } from "./types"

/** Configuración regional y de negocio en un único lugar. */
export const FINANCE_CONFIG = {
  locale: "es-AR",
  currency: "ARS",
  storageKey: "gastos-app:finance:v1",
  /** Porcentaje del límite a partir del cual un presupuesto pasa a "cerca del límite". */
  warningThreshold: 0.9,
} as const

/** Paleta categórica (validada para daltonismo); el valor real vive en globals.css. */
export const CATEGORY_COLORS: readonly CategoryColor[] = [
  "blue",
  "orange",
  "aqua",
  "yellow",
  "magenta",
  "green",
  "violet",
  "red",
]

export const COLOR_LABEL: Record<CategoryColor, string> = {
  blue: "Azul",
  orange: "Naranja",
  aqua: "Aqua",
  yellow: "Amarillo",
  magenta: "Magenta",
  green: "Verde",
  violet: "Violeta",
  red: "Rojo",
}

/** Variable CSS del color de una categoría (definida en globals.css para claro y oscuro). */
export const colorVar = (color: CategoryColor) => `var(--cat-${color})`

/** Ids fijos de las categorías de sistema (destino al borrar una categoría). */
export const FALLBACK_CATEGORY = {
  expense: "otros",
  income: "otros-ingresos",
} as const
