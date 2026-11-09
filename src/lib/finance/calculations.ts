/**
 * Motor de planificación: funciones PURAS que derivan todo lo que muestra la UI
 * a partir del estado. Sin React, sin efectos: fáciles de testear y reutilizar.
 */
import { FINANCE_CONFIG } from "./config"
import { currentMonthKey, dateInMonth, monthKeyOf, roundMoney, shiftMonth, todayISO } from "./format"
import type {
  BudgetStatus,
  Category,
  FinanceState,
  ISODate,
  MonthKey,
  RecurringItem,
  SavingsGoal,
  Transaction,
} from "./types"

const sum = (values: number[]) => roundMoney(values.reduce((acc, v) => acc + v, 0))

/* ----------------------------------------------------------------------------
 * Movimientos
 * ------------------------------------------------------------------------- */

export const byDateDesc = (a: Transaction, b: Transaction) =>
  b.date.localeCompare(a.date) || b.createdAt - a.createdAt

export function transactionsInMonth(state: FinanceState, month: MonthKey): Transaction[] {
  return state.transactions.filter((t) => monthKeyOf(t.date) === month)
}

/* ----------------------------------------------------------------------------
 * Fijos / recurrentes
 * ------------------------------------------------------------------------- */

export interface RecurringOccurrence {
  item: RecurringItem
  /** Fecha prevista en el mes analizado. */
  date: ISODate
  /** Movimiento real que lo registró (si ya se pagó/cobró). */
  transaction?: Transaction
  status: "paid" | "pending" | "overdue" | "missed"
}

/**
 * Ocurrencias de cada fijo activo en un mes.
 * - paid: ya existe un movimiento vinculado.
 * - pending/overdue: mes actual o futuro, aún sin registrar (se proyecta).
 * - missed: mes pasado sin registrar (no se proyecta: ya no sucederá).
 */
export function recurringForMonth(state: FinanceState, month: MonthKey): RecurringOccurrence[] {
  const today = todayISO()
  const isPast = month < currentMonthKey()
  const monthTx = transactionsInMonth(state, month)

  return state.recurring
    .map((item): RecurringOccurrence | null => {
      const transaction = monthTx.find((t) => t.recurringId === item.id)
      const date = dateInMonth(month, item.dayOfMonth)
      if (transaction) return { item, date, transaction, status: "paid" }
      if (!item.active) return null
      if (isPast) return { item, date, status: "missed" }
      return { item, date, status: date < today ? "overdue" : "pending" }
    })
    .filter((o): o is RecurringOccurrence => o !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** Un fijo cuenta como "por pagar" (proyectado) si está pendiente o vencido. */
const isProjected = (o: RecurringOccurrence) => o.status === "pending" || o.status === "overdue"

/* ----------------------------------------------------------------------------
 * Presupuestos por categoría
 * ------------------------------------------------------------------------- */

export interface CategoryBudget {
  category: Category
  limit: number
  /** Gastado real en el mes. */
  spent: number
  /** Fijos aún no registrados que caerán en esta categoría. */
  pendingFixed: number
  /** spent + pendingFixed: lo que se espera gastar como mínimo. */
  projected: number
  /** limit − projected (negativo = excedido). */
  remaining: number
  /** projected / limit (0 si no hay límite). */
  ratio: number
  status: BudgetStatus
}

export function budgetStatus(projected: number, limit: number): BudgetStatus {
  if (limit <= 0) return "unbudgeted"
  const ratio = projected / limit
  if (ratio > 1) return "over"
  if (ratio >= FINANCE_CONFIG.warningThreshold) return "warning"
  return "ok"
}

export function categoryBudgets(state: FinanceState, month: MonthKey): CategoryBudget[] {
  const monthTx = transactionsInMonth(state, month)
  const pending = recurringForMonth(state, month).filter((o) => isProjected(o) && o.item.type === "expense")

  return state.categories
    .filter((c) => c.kind === "expense")
    .map((category) => {
      const spent = sum(monthTx.filter((t) => t.type === "expense" && t.categoryId === category.id).map((t) => t.amount))
      const pendingFixed = sum(pending.filter((o) => o.item.categoryId === category.id).map((o) => o.item.amount))
      const projected = roundMoney(spent + pendingFixed)
      const limit = category.monthlyLimit
      return {
        category,
        limit,
        spent,
        pendingFixed,
        projected,
        remaining: roundMoney(limit - projected),
        ratio: limit > 0 ? projected / limit : 0,
        status: budgetStatus(projected, limit),
      }
    })
}

/** Gasto promedio de una categoría en los N meses anteriores (referencia para fijar límites). */
export function averageMonthlySpend(state: FinanceState, categoryId: string, month: MonthKey, months = 3): number {
  const keys = Array.from({ length: months }, (_, i) => shiftMonth(month, -(i + 1)))
  const totals = keys.map((key) =>
    sum(
      transactionsInMonth(state, key)
        .filter((t) => t.type === "expense" && t.categoryId === categoryId)
        .map((t) => t.amount)
    )
  )
  const monthsWithData = totals.filter((t) => t > 0).length
  return monthsWithData ? roundMoney(sum(totals) / monthsWithData) : 0
}

/* ----------------------------------------------------------------------------
 * Metas de ahorro
 * ------------------------------------------------------------------------- */

export interface GoalProgress {
  goal: SavingsGoal
  saved: number
  remaining: number
  ratio: number
  completed: boolean
  /** Meses de aporte que quedan hasta la fecha límite, o null sin fecha. */
  monthsLeft: number | null
  /** Aporte mensual necesario para llegar a tiempo. */
  requiredMonthly: number | null
  /** ¿El aporte planificado alcanza para llegar a la fecha límite? */
  onTrack: boolean | null
  /** Mes estimado de finalización con el aporte planificado actual. */
  projectedCompletion: MonthKey | null
  /** Abonos netos del mes actual. */
  contributedThisMonth: number
}

/** Cuántos meses tarda en completarse `remaining` aportando `monthly` por mes. */
export function simulateGoal(remaining: number, monthly: number, fromMonth: MonthKey = currentMonthKey()) {
  if (remaining <= 0) return { months: 0, completion: fromMonth }
  if (monthly <= 0) return { months: null, completion: null }
  const months = Math.ceil(remaining / monthly)
  // El aporte de este mes cuenta: con 1 mes de aporte se completa en el mes actual.
  return { months, completion: shiftMonth(fromMonth, months - 1) }
}

export function goalProgress(state: FinanceState, goal: SavingsGoal): GoalProgress {
  const thisMonth = currentMonthKey()
  const movements = state.goalMovements.filter((m) => m.goalId === goal.id)
  const saved = Math.max(0, sum(movements.map((m) => m.amount)))
  const remaining = Math.max(0, roundMoney(goal.targetAmount - saved))
  const completed = remaining === 0
  const contributedThisMonth = sum(movements.filter((m) => monthKeyOf(m.date) === thisMonth).map((m) => m.amount))

  // Si el aporte de este mes ya se hizo, los aportes pendientes empiezan el mes próximo.
  const currentMonthDone = goal.monthlyContribution > 0 && contributedThisMonth >= goal.monthlyContribution
  const firstContributionMonth = currentMonthDone ? shiftMonth(thisMonth, 1) : thisMonth

  let monthsLeft: number | null = null
  let requiredMonthly: number | null = null
  let onTrack: boolean | null = null

  if (goal.deadline && !completed) {
    const deadlineMonth = monthKeyOf(goal.deadline)
    const [y1, m1] = firstContributionMonth.split("-").map(Number)
    const [y2, m2] = deadlineMonth.split("-").map(Number)
    monthsLeft = Math.max(1, (y2 - y1) * 12 + (m2 - m1) + 1)
    requiredMonthly = roundMoney(remaining / monthsLeft)
    onTrack = goal.monthlyContribution + 0.5 >= requiredMonthly
  }

  return {
    goal,
    saved,
    remaining,
    ratio: goal.targetAmount > 0 ? Math.min(1, saved / goal.targetAmount) : 0,
    completed,
    monthsLeft,
    requiredMonthly,
    onTrack: completed ? true : onTrack,
    projectedCompletion: completed ? null : simulateGoal(remaining, goal.monthlyContribution, firstContributionMonth).completion,
    contributedThisMonth,
  }
}

/* ----------------------------------------------------------------------------
 * Plan del mes (vista principal)
 * ------------------------------------------------------------------------- */

export interface MonthPlan {
  month: MonthKey
  timing: "past" | "current" | "future"
  income: { actual: number; pending: number; expected: number }
  expenses: { actual: number; pendingFixed: number; projected: number }
  budgets: {
    rows: CategoryBudget[]
    totalLimit: number
    /** Σ de lo que aún queda por gastar dentro de los límites. */
    remainingBudget: number
    overCount: number
    warningCount: number
  }
  savings: { planned: number; deposited: number; reserved: number }
  /**
   * Saldo libre = ingresos previstos − gastos proyectados − ahorro reservado.
   * Es el dinero que todavía podés gastar este mes sin romper el plan de ahorro.
   */
  freeBalance: number
  /** Ingresos que no tienen destino (ni gastado, ni fijo, ni presupuesto, ni ahorro). */
  unassigned: number
  recurring: RecurringOccurrence[]
}

export function monthPlan(state: FinanceState, month: MonthKey): MonthPlan {
  const current = currentMonthKey()
  const timing = month < current ? "past" : month > current ? "future" : "current"
  const monthTx = transactionsInMonth(state, month)
  const recurring = recurringForMonth(state, month)
  const projected = recurring.filter(isProjected)

  const incomeActual = sum(monthTx.filter((t) => t.type === "income").map((t) => t.amount))
  const incomePending = sum(projected.filter((o) => o.item.type === "income").map((o) => o.item.amount))
  const expenseActual = sum(monthTx.filter((t) => t.type === "expense").map((t) => t.amount))
  const expensePending = sum(projected.filter((o) => o.item.type === "expense").map((o) => o.item.amount))

  const rows = categoryBudgets(state, month)
  const limited = rows.filter((r) => r.limit > 0)
  const remainingBudget = sum(limited.map((r) => Math.max(0, r.remaining)))

  // Ahorro: lo planificado en metas activas, o lo efectivamente abonado si fue más.
  const activeGoals = state.goals.filter((g) => !goalProgress(state, g).completed)
  const planned = sum(activeGoals.map((g) => g.monthlyContribution))
  const deposited = sum(state.goalMovements.filter((m) => monthKeyOf(m.date) === month).map((m) => m.amount))
  const reserved = Math.max(planned, deposited, 0)

  const expected = roundMoney(incomeActual + incomePending)
  const projectedExpenses = roundMoney(expenseActual + expensePending)

  return {
    month,
    timing,
    income: { actual: incomeActual, pending: incomePending, expected },
    expenses: { actual: expenseActual, pendingFixed: expensePending, projected: projectedExpenses },
    budgets: {
      rows,
      totalLimit: sum(limited.map((r) => r.limit)),
      remainingBudget,
      overCount: rows.filter((r) => r.status === "over").length,
      warningCount: rows.filter((r) => r.status === "warning").length,
    },
    savings: { planned, deposited, reserved },
    freeBalance: roundMoney(expected - projectedExpenses - reserved),
    unassigned: roundMoney(expected - projectedExpenses - remainingBudget - reserved),
    recurring,
  }
}
