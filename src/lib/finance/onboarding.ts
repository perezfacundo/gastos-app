/**
 * Configuración inicial guiada: a partir del ingreso y los gastos fijos, arma
 * un plan completo (límites sugeridos + fijos + meta de ahorro).
 * Funciones puras: ver onboarding.test.ts.
 */
import { FALLBACK_CATEGORY } from "./config"
import { generateId, roundMoney } from "./format"
import type { Category, FinanceState, RecurringItem, SavingsGoal } from "./types"

export interface FixedPreset {
  key: string
  label: string
  categoryId: string
  day: number
}

/** Gastos fijos típicos: se eligen con un toque. */
export const FIXED_PRESETS: FixedPreset[] = [
  { key: "alquiler", label: "Alquiler", categoryId: "vivienda", day: 5 },
  { key: "expensas", label: "Expensas", categoryId: "vivienda", day: 10 },
  { key: "luz", label: "Luz", categoryId: "servicios", day: 15 },
  { key: "gas", label: "Gas", categoryId: "servicios", day: 15 },
  { key: "internet", label: "Internet", categoryId: "servicios", day: 10 },
  { key: "celular", label: "Celular", categoryId: "servicios", day: 10 },
  { key: "prepaga", label: "Prepaga / obra social", categoryId: "salud", day: 5 },
  { key: "gimnasio", label: "Gimnasio", categoryId: "salud", day: 5 },
  { key: "streaming", label: "Streaming", categoryId: "ocio", day: 12 },
  { key: "seguro-auto", label: "Seguro del auto", categoryId: "transporte", day: 10 },
]

/** Reparto sugerido de lo que queda para gastos variables (suma 1). */
export const VARIABLE_SHARES: Record<string, number> = {
  alimentacion: 0.45,
  transporte: 0.15,
  ocio: 0.15,
  salud: 0.1,
  otros: 0.15,
}

export const DEFAULT_SAVINGS_RATE = 0.1

export interface FixedInput {
  description: string
  categoryId: string
  amount: number
  day: number
}

export interface OnboardingInput {
  income: number
  incomeDay: number
  fixed: FixedInput[]
  /** Aporte mensual a un "Fondo de emergencia" (0 = no crear meta). */
  savings: number
  limits: Record<string, number>
}

/** Redondeos a múltiplos de 1.000 (números fáciles de recordar). */
const roundUp = (n: number) => Math.ceil(n / 1000) * 1000
const roundDown = (n: number) => Math.floor(n / 1000) * 1000

export const suggestSavings = (income: number) => Math.max(0, Math.round((income * DEFAULT_SAVINGS_RATE) / 1000) * 1000)

/**
 * Límites sugeridos por categoría de gasto:
 *   límite = fijos de la categoría (redondeados ↑, deben alcanzar)
 *          + parte del dinero variable (redondeada ↓, para no pasarse del ingreso).
 * Variable = ingreso − fijos − ahorro (nunca negativo).
 * Garantía: si el ingreso alcanza, la suma de límites + ahorro NO supera el ingreso.
 */
export function suggestLimits(
  categories: Category[],
  income: number,
  fixed: FixedInput[],
  savings: number
): Record<string, number> {
  const fixedTotal = fixed.reduce((s, f) => s + f.amount, 0)
  const variable = Math.max(0, income - fixedTotal - savings)

  const limits: Record<string, number> = {}
  for (const c of categories.filter((c) => c.kind === "expense")) {
    const fixedInCategory = fixed.filter((f) => f.categoryId === c.id).reduce((s, f) => s + f.amount, 0)
    const share = (VARIABLE_SHARES[c.id] ?? 0) * variable
    limits[c.id] = roundUp(fixedInCategory) + roundDown(share)
  }

  // Redondear los fijos hacia arriba puede pasarse por algunos miles: se descuenta
  // de la categoría variable más grande.
  const excess = Object.values(limits).reduce((s, n) => s + n, 0) + savings - income
  if (excess > 0 && variable > 0) {
    const biggest = Object.keys(VARIABLE_SHARES)
      .filter((id) => id in limits)
      .sort((a, b) => VARIABLE_SHARES[b] - VARIABLE_SHARES[a])[0]
    if (biggest) limits[biggest] = Math.max(0, limits[biggest] - roundUp(excess))
  }
  return limits
}

/** Construye el estado completo del plan (se guarda de una sola vez, atómico). */
export function buildOnboardingState(base: FinanceState, input: OnboardingInput, now = Date.now()): FinanceState {
  const incomeCategory = base.categories.find((c) => c.id === "sueldo") ?? base.categories.find((c) => c.kind === "income")

  const categories = base.categories.map((c) =>
    c.kind === "expense" ? { ...c, monthlyLimit: roundMoney(Math.max(0, input.limits[c.id] ?? 0)) } : c
  )
  const validCategory = (id: string) =>
    categories.some((c) => c.id === id && c.kind === "expense") ? id : FALLBACK_CATEGORY.expense

  const recurring: RecurringItem[] = [
    ...(input.income > 0 && incomeCategory
      ? [
          {
            id: generateId(),
            description: "Sueldo",
            amount: roundMoney(input.income),
            type: "income" as const,
            categoryId: incomeCategory.id,
            dayOfMonth: input.incomeDay,
            active: true,
            autoRegister: true,
          },
        ]
      : []),
    ...input.fixed
      .filter((f) => f.amount > 0)
      .map((f) => ({
        id: generateId(),
        description: f.description.trim() || "Gasto fijo",
        amount: roundMoney(f.amount),
        type: "expense" as const,
        categoryId: validCategory(f.categoryId),
        dayOfMonth: Math.min(31, Math.max(1, Math.round(f.day))),
        active: true,
        // Automáticos: quien solo planifica no tiene que tocar "Pagar" cada mes.
        // Los ya vencidos este mes se registran solos al terminar (dueAutoRegistrations).
        autoRegister: true,
      })),
  ]

  const goals: SavingsGoal[] =
    input.savings > 0
      ? [
          {
            id: generateId(),
            name: "Fondo de emergencia",
            icon: "shield",
            color: "aqua",
            // Objetivo clásico: 3 meses de gastos fijos (o de ingreso si no hay fijos).
            targetAmount: roundUp(Math.max(input.fixed.reduce((s, f) => s + f.amount, 0), input.income) * 3),
            monthlyContribution: roundMoney(input.savings),
            deadline: null,
            createdAt: now,
          },
        ]
      : []

  return { version: 1, categories, recurring, transactions: [], goals, goalMovements: [] }
}
