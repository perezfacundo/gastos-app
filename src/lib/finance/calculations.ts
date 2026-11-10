/**
 * Motor de planificación: funciones PURAS que derivan todo lo que muestra la UI
 * a partir del estado. Sin React, sin efectos: fáciles de testear y reutilizar.
 */
import { FINANCE_CONFIG } from "./config"
import { currentMonthKey, dateInMonth, daysInMonth, monthKeyOf, roundMoney, shiftMonth, todayISO } from "./format"
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
      if (item.autoRegister) {
        // Ya se registró solo este mes y el usuario lo borró (ej. no se cobró): no se proyecta.
        if (item.lastAutoMonth && item.lastAutoMonth >= month) return { item, date, status: "missed" }
        // Si no, se va a registrar solo: nunca está "vencido".
        return { item, date, status: "pending" }
      }
      return { item, date, status: date < today ? "overdue" : "pending" }
    })
    .filter((o): o is RecurringOccurrence => o !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
}

export interface DueAutoRegistration {
  item: RecurringItem
  date: ISODate
  month: MonthKey
  /** Id determinístico: dos dispositivos que lo registran a la vez crean LA MISMA fila. */
  transactionId: string
}

/**
 * Fijos automáticos que hoy ya deberían estar registrados (mes actual, fecha ≤ hoy)
 * y todavía no lo están ni se registraron antes (lastAutoMonth).
 */
export function dueAutoRegistrations(state: FinanceState, today: ISODate = todayISO()): DueAutoRegistration[] {
  const month = monthKeyOf(today)
  const paid = new Set(transactionsInMonth(state, month).map((t) => t.recurringId).filter(Boolean))
  return state.recurring
    .filter((r) => r.active && r.autoRegister && !paid.has(r.id) && !(r.lastAutoMonth && r.lastAutoMonth >= month))
    .map((item) => ({ item, month, date: dateInMonth(month, item.dayOfMonth), transactionId: `auto-${item.id}-${month}` }))
    .filter((d) => d.date <= today)
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
  /** Parte de lo proyectado que corresponde a fijos (pagados o por pagar). */
  fixedCommitted: number
  status: BudgetStatus
}

/**
 * Estado de un presupuesto.
 *  - over:    lo proyectado supera el límite.
 *  - warning: queda poco margen para gastos VARIABLES. Lo comprometido por fijos
 *             (`fixedCommitted`) no cuenta: una categoría que es 100% alquiler está
 *             siempre "llena" y eso no es una alerta (las alertas que siempre están
 *             encendidas enseñan a ignorarlas).
 */
export function budgetStatus(projected: number, limit: number, fixedCommitted = 0): BudgetStatus {
  if (limit <= 0) return "unbudgeted"
  if (projected > limit) return "over"
  const variableRoom = limit - fixedCommitted
  if (variableRoom <= 0) return "ok" // todo el límite es de fijos y no se pasó
  const variableUsed = projected - fixedCommitted
  if (variableUsed / variableRoom >= FINANCE_CONFIG.warningThreshold) return "warning"
  return "ok"
}

export function categoryBudgets(state: FinanceState, month: MonthKey): CategoryBudget[] {
  const monthTx = transactionsInMonth(state, month)
  const pending = recurringForMonth(state, month).filter((o) => isProjected(o) && o.item.type === "expense")

  return state.categories
    .filter((c) => c.kind === "expense")
    .map((category) => {
      const categoryTx = monthTx.filter((t) => t.type === "expense" && t.categoryId === category.id)
      const spent = sum(categoryTx.map((t) => t.amount))
      const fixedPaid = sum(categoryTx.filter((t) => t.recurringId).map((t) => t.amount))
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
        fixedCommitted: roundMoney(fixedPaid + pendingFixed),
        status: budgetStatus(projected, limit, fixedPaid + pendingFixed),
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

/* ----------------------------------------------------------------------------
 * Ritmo de gasto: "¿cuánto puedo gastar por día?"
 * ------------------------------------------------------------------------- */

export interface SpendingPace {
  timing: MonthPlan["timing"]
  /** Días que quedan en el mes, contando hoy (mes actual) o el mes entero (futuro). */
  daysLeft: number
  /** Monto diario sugerido, calculado al INICIO del día (no cambia con cada gasto de hoy). */
  perDay: number
  /** Gastos variables de hoy (sin fijos: esos ya estaban en el plan). */
  spentToday: number
  /** Lo que queda para hoy (negativo = hoy se gastó más que el diario). */
  leftToday: number
  /** Saldo libre del mes (ingresos previstos − gastos proyectados − ahorro). */
  available: number
  status: "ok" | "tight" | "over"
}

export function spendingPace(state: FinanceState, plan: MonthPlan, today: ISODate = todayISO()): SpendingPace {
  const available = plan.freeBalance
  const totalDays = daysInMonth(plan.month)

  if (plan.timing === "past") {
    return { timing: "past", daysLeft: 0, perDay: 0, spentToday: 0, leftToday: 0, available, status: available < 0 ? "over" : "ok" }
  }

  if (plan.timing === "future") {
    const perDay = Math.max(0, available) / totalDays
    return { timing: "future", daysLeft: totalDays, perDay, spentToday: 0, leftToday: perDay, available, status: available < 0 ? "over" : "ok" }
  }

  const day = Number(today.slice(8, 10))
  const daysLeft = totalDays - day + 1
  const spentToday = sum(
    state.transactions.filter((t) => t.date === today && t.type === "expense" && !t.recurringId).map((t) => t.amount)
  )
  // Al inicio del día el saldo libre incluía lo que hoy se gastó.
  const perDay = Math.max(0, available + spentToday) / daysLeft
  const leftToday = roundMoney(perDay - spentToday)

  return {
    timing: "current",
    daysLeft,
    perDay: roundMoney(perDay),
    spentToday,
    leftToday,
    available,
    status: available < 0 ? "over" : leftToday < 0 ? "tight" : "ok",
  }
}
