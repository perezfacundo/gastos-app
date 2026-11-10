/**
 * Qué usa esta persona y qué podemos decirle con SUS datos.
 *
 * La app no tiene "modos": cada pantalla mira el perfil de uso y se adapta.
 *  - Solo anota gastos  → ve en qué gasta y cómo viene contra el mes pasado.
 *  - Solo planifica     → ve su presupuesto diario y su plan.
 *  - Las dos cosas      → cada módulo suma contexto al otro.
 * Funciones puras: ver insights.test.ts.
 */
import { monthPlan, transactionsInMonth } from "./calculations"
import { currentMonthKey, daysInMonth, roundMoney, shiftMonth, todayISO } from "./format"
import type { FinanceState, ISODate, MonthKey } from "./types"

export interface UsageProfile {
  /** Hay ingreso previsto o cobrado en el mes: se puede calcular "cuánto podés gastar". */
  hasIncome: boolean
  /** Alguna categoría de gasto tiene límite. */
  hasLimits: boolean
  /** Hay gastos o ingresos fijos activos. */
  hasRecurring: boolean
  hasGoals: boolean
  /** Anota gastos a mano (no fijos) en este mes o el anterior. */
  tracksSpending: boolean
  /** Usa la parte de planificación (ingreso, límites o metas). */
  plans: boolean
}

export function usageProfile(state: FinanceState, month: MonthKey = currentMonthKey()): UsageProfile {
  const plan = monthPlan(state, month)
  const hasIncome = plan.income.expected > 0
  const hasLimits = state.categories.some((c) => c.kind === "expense" && c.monthlyLimit > 0)
  const hasRecurring = state.recurring.some((r) => r.active)
  const hasGoals = state.goals.length > 0
  const recentMonths = new Set([month, shiftMonth(month, -1)])
  const tracksSpending = state.transactions.some(
    (t) => t.type === "expense" && !t.recurringId && recentMonths.has(t.date.slice(0, 7))
  )
  return { hasIncome, hasLimits, hasRecurring, hasGoals, tracksSpending, plans: hasIncome || hasLimits || hasGoals }
}

export interface SpendingSummary {
  /** Todos los gastos del mes (variables + fijos registrados). */
  total: number
  /** Solo lo anotado a mano. */
  variable: number
  count: number
  /** Días transcurridos (mes actual), o el mes completo (pasado). */
  elapsedDays: number
  dailyAverage: number
  /**
   * Lo gastado el mes anterior HASTA EL MISMO DÍA (comparar contra el mes completo
   * a mitad de mes sería engañoso). null si el mes anterior no tiene datos.
   */
  previousToDate: number | null
  /** total / previousToDate − 1 (ej. 0.12 = 12 % más). */
  change: number | null
  /** Categoría con más gasto en el mes. */
  topCategoryId: string | null
}

export function spendingSummary(state: FinanceState, month: MonthKey, today: ISODate = todayISO()): SpendingSummary {
  const isCurrent = month === today.slice(0, 7)
  const elapsedDays = isCurrent ? Number(today.slice(8, 10)) : daysInMonth(month)
  const expenses = transactionsInMonth(state, month).filter((t) => t.type === "expense")
  const total = roundMoney(expenses.reduce((s, t) => s + t.amount, 0))
  const variable = roundMoney(expenses.filter((t) => !t.recurringId).reduce((s, t) => s + t.amount, 0))

  const previousMonth = shiftMonth(month, -1)
  const previousExpenses = transactionsInMonth(state, previousMonth).filter((t) => t.type === "expense")
  const cutoffDay = Math.min(elapsedDays, daysInMonth(previousMonth))
  const previousToDate = previousExpenses.length
    ? roundMoney(previousExpenses.filter((t) => Number(t.date.slice(8, 10)) <= cutoffDay).reduce((s, t) => s + t.amount, 0))
    : null

  const byCategory = new Map<string, number>()
  for (const t of expenses) byCategory.set(t.categoryId, (byCategory.get(t.categoryId) ?? 0) + t.amount)
  const topCategoryId = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return {
    total,
    variable,
    count: expenses.length,
    elapsedDays,
    dailyAverage: elapsedDays ? roundMoney(total / elapsedDays) : 0,
    previousToDate,
    change: previousToDate ? total / previousToDate - 1 : null,
    topCategoryId,
  }
}
