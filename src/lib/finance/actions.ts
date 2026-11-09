/**
 * Acciones de alto nivel (casos de uso). Encapsulan la creación de ids, fechas
 * y redondeos para que los componentes solo pasen datos del formulario.
 */
import { dateInMonth, generateId, roundMoney, todayISO } from "./format"
import { createEmptyState, createMockState } from "./mock-data"
import { financeStore } from "./store"
import type { Category, GoalMovement, ISODate, MonthKey, RecurringItem, SavingsGoal, Transaction } from "./types"

const { dispatch } = financeStore

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
    const removed = financeStore.getSnapshot().transactions.find((t) => t.id === id)
    if (removed) dispatch({ type: "transaction/remove", id })
    return removed
  },

  restoreTransaction(transaction: Transaction) {
    dispatch({ type: "transaction/add", transaction })
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
    const removed = financeStore.getSnapshot().recurring.find((r) => r.id === id)
    if (removed) dispatch({ type: "recurring/remove", id })
    return removed
  },

  restoreRecurring(item: RecurringItem) {
    dispatch({ type: "recurring/upsert", item })
  },

  /** Registra el pago/cobro real de un fijo en un mes (crea el movimiento vinculado). */
  registerRecurring(item: RecurringItem, month: MonthKey, date?: ISODate): Transaction {
    return financeActions.addTransaction({
      description: item.description,
      amount: item.amount,
      type: item.type,
      categoryId: item.categoryId,
      date: date ?? dateInMonth(month, item.dayOfMonth),
      recurringId: item.id,
    })
  },

  /* ------------------------------- Metas ------------------------------- */
  saveGoal(input: GoalInput, id?: string): SavingsGoal {
    const existing = id ? financeStore.getSnapshot().goals.find((g) => g.id === id) : undefined
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
    const goal = snapshot.goals.find((g) => g.id === id)
    if (!goal) return undefined
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
  resetToSample() {
    dispatch({ type: "state/replace", state: createMockState() })
  },

  clearAll() {
    dispatch({ type: "state/replace", state: createEmptyState() })
  },
}
