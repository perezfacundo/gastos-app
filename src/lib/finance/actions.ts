/**
 * Acciones de alto nivel (casos de uso). Encapsulan la creación de ids, fechas
 * y redondeos para que los componentes solo pasen datos del formulario.
 */
import { dueAutoRegistrations } from "./calculations"
import { FALLBACK_CATEGORY } from "./config"
import { dateInMonth, generateId, roundMoney, todayISO } from "./format"
import { createEmptyState, createMockState } from "./mock-data"
import { financeStore } from "./store"
import type { Category, FinanceState, GoalMovement, ISODate, MonthKey, RecurringItem, SavingsGoal, Transaction } from "./types"

/**
 * "Dispara y olvida": la UI ya se actualizó de forma optimista y, si el guardado
 * falla, el store avisa al usuario (toast) y recarga del servidor. Atrapar el
 * rechazo acá evita errores "Uncaught (in promise)" en consola.
 */
const dispatch = (action: Parameters<typeof financeStore.dispatch>[0]) => {
  financeStore.dispatch(action).catch(() => undefined)
}

export type TransactionInput = Omit<Transaction, "id" | "createdAt">
export type RecurringInput = Omit<RecurringItem, "id">
export type GoalInput = Omit<SavingsGoal, "id" | "createdAt">
export type CategoryInput = Omit<Category, "id">
export type RemovedGoal = { goal: SavingsGoal; movements: GoalMovement[] }

export const financeActions = {
  /* ---------------------------- Movimientos ---------------------------- */
  addTransaction(input: TransactionInput): Transaction {
    const transaction: Transaction = {
      ...input,
      description: input.description.trim(),
      amount: roundMoney(input.amount),
      id: generateId(),
      createdAt: Date.now(),
    }
    dispatch({ type: "transaction/add", transaction })
    return transaction
  },

  /** Devuelve el movimiento borrado para poder ofrecer "Deshacer". */
  removeTransaction(id: string): Transaction | undefined {
    const removed = financeStore.getSnapshot()?.transactions.find((t) => t.id === id)
    if (removed) dispatch({ type: "transaction/remove", id })
    return removed
  },

  restoreTransaction(transaction: Transaction) {
    dispatch({ type: "transaction/add", transaction })
  },

  /** Edita un movimiento: mismo id y fecha de creación (el upsert lo reemplaza). */
  updateTransaction(original: Transaction, input: TransactionInput): Transaction {
    const transaction: Transaction = {
      ...input,
      description: input.description.trim(),
      amount: roundMoney(input.amount),
      id: original.id,
      createdAt: original.createdAt,
    }
    dispatch({ type: "transaction/add", transaction })
    return transaction
  },

  /* ----------------------------- Categorías ---------------------------- */
  saveCategory(input: CategoryInput, id?: string): Category {
    const category: Category = { ...input, name: input.name.trim(), id: id ?? generateId() }
    dispatch({ type: "category/upsert", category })
    return category
  },

  setCategoryLimit(id: string, limit: number) {
    dispatch({ type: "category/setLimit", id, limit: roundMoney(limit) })
  },

  removeCategory(id: string) {
    dispatch({ type: "category/remove", id })
  },

  /* ------------------------------- Fijos ------------------------------- */
  saveRecurring(input: RecurringInput, id?: string): RecurringItem {
    const item: RecurringItem = {
      ...input,
      description: input.description.trim(),
      amount: roundMoney(input.amount),
      id: id ?? generateId(),
    }
    dispatch({ type: "recurring/upsert", item })
    return item
  },

  removeRecurring(id: string): RecurringItem | undefined {
    const removed = financeStore.getSnapshot()?.recurring.find((r) => r.id === id)
    if (removed) dispatch({ type: "recurring/remove", id })
    return removed
  },

  restoreRecurring(item: RecurringItem) {
    dispatch({ type: "recurring/upsert", item })
  },

  /** Registra el pago/cobro real de un fijo en un mes (crea el movimiento vinculado). */
  /**
   * Registra el pago/cobro real de un fijo en un mes.
   * `amount` permite registrar el monto REAL (la luz nunca cuesta lo mismo).
   */
  registerRecurring(item: RecurringItem, month: MonthKey, date?: ISODate, amount = item.amount): Transaction {
    return financeActions.addTransaction({
      description: item.description,
      amount,
      type: item.type,
      categoryId: item.categoryId,
      date: date ?? dateInMonth(month, item.dayOfMonth),
      recurringId: item.id,
    })
  },

  /**
   * Registra los fijos automáticos vencidos (débitos automáticos).
   * Idempotente: id determinístico + marca `lastAutoMonth` (si el usuario borra
   * el movimiento, no se vuelve a crear).
   */
  autoRegisterDue(state: FinanceState, today: ISODate = todayISO()): number {
    const due = dueAutoRegistrations(state, today)
    for (const { item, date, month, transactionId } of due) {
      dispatch({
        type: "transaction/add",
        transaction: {
          id: transactionId,
          description: item.description,
          amount: item.amount,
          type: item.type,
          categoryId: item.categoryId,
          date,
          recurringId: item.id,
          createdAt: Date.now(),
        },
      })
      dispatch({ type: "recurring/upsert", item: { ...item, lastAutoMonth: month } })
    }
    return due.length
  },

  /** Puerta de entrada al plan: carga el ingreso mensual como fijo automático. */
  setupIncome(state: FinanceState, amount: number, dayOfMonth: number): RecurringItem {
    const category = state.categories.find((c) => c.id === "sueldo") ?? state.categories.find((c) => c.kind === "income")
    return financeActions.saveRecurring({
      description: "Sueldo",
      amount,
      type: "income",
      categoryId: category?.id ?? FALLBACK_CATEGORY.income,
      dayOfMonth: Math.min(31, Math.max(1, Math.round(dayOfMonth))),
      active: true,
      autoRegister: true,
    })
  },

  /**
   * Aplica un plan (asistente) SIN borrar nada: límites, fijos nuevos y metas.
   * Así quien empezó anotando gastos puede sumar el plan y conservar su historial.
   */
  applyPlan(plan: Pick<FinanceState, "categories" | "recurring" | "goals">, current: FinanceState) {
    for (const category of plan.categories) {
      const existing = current.categories.find((c) => c.id === category.id)
      if (category.kind === "expense" && existing && existing.monthlyLimit !== category.monthlyLimit) {
        dispatch({ type: "category/setLimit", id: category.id, limit: category.monthlyLimit })
      }
    }
    for (const item of plan.recurring) dispatch({ type: "recurring/upsert", item })
    for (const goal of plan.goals) dispatch({ type: "goal/upsert", goal })
  },

  /* ------------------------------- Metas ------------------------------- */
  saveGoal(input: GoalInput, id?: string): SavingsGoal {
    const existing = id ? financeStore.getSnapshot()?.goals.find((g) => g.id === id) : undefined
    const goal: SavingsGoal = {
      ...input,
      name: input.name.trim(),
      targetAmount: roundMoney(input.targetAmount),
      monthlyContribution: roundMoney(input.monthlyContribution),
      id: existing?.id ?? generateId(),
      createdAt: existing?.createdAt ?? Date.now(),
    }
    dispatch({ type: "goal/upsert", goal })
    return goal
  },

  removeGoal(id: string): RemovedGoal | undefined {
    const snapshot = financeStore.getSnapshot()
    const goal = snapshot?.goals.find((g) => g.id === id)
    if (!snapshot || !goal) return undefined
    const movements = snapshot.goalMovements.filter((m) => m.goalId === id)
    dispatch({ type: "goal/remove", id })
    return { goal, movements }
  },

  restoreGoal(removed: RemovedGoal) {
    dispatch({ type: "goal/restore", ...removed })
  },

  /** Abona (amount > 0) o retira (amount < 0) fondos de una meta. */
  moveGoalFunds(goalId: string, amount: number, date: ISODate = todayISO()) {
    dispatch({ type: "goal/move", movement: { id: generateId(), goalId, amount: roundMoney(amount), date } })
  },

  /* ------------------------------- Datos ------------------------------- */
  /** Reemplaza todo por los datos de ejemplo. Devuelve la promesa del guardado. */
  resetToSample() {
    return financeStore.dispatch({ type: "state/replace", state: createMockState() })
  },

  /** Borra movimientos, fijos y metas; deja las categorías base sin límites. */
  clearAll() {
    return financeStore.dispatch({ type: "state/replace", state: createEmptyState() })
  },
}
