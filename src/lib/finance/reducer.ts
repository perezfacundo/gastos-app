import { FALLBACK_CATEGORY } from "./config"
import type { Category, FinanceState, GoalMovement, RecurringItem, SavingsGoal, Transaction } from "./types"

export type FinanceAction =
  | { type: "transaction/add"; transaction: Transaction }
  | { type: "transaction/remove"; id: string }
  | { type: "category/upsert"; category: Category }
  | { type: "category/remove"; id: string }
  | { type: "category/setLimit"; id: string; limit: number }
  | { type: "recurring/upsert"; item: RecurringItem }
  | { type: "recurring/remove"; id: string }
  | { type: "goal/upsert"; goal: SavingsGoal }
  | { type: "goal/remove"; id: string }
  | { type: "goal/restore"; goal: SavingsGoal; movements: GoalMovement[] }
  | { type: "goal/move"; movement: GoalMovement }
  | { type: "state/replace"; state: FinanceState }

/** Inserta o reemplaza por id, preservando el orden existente. */
function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex((x) => x.id === item.id)
  if (index === -1) return [...list, item]
  const next = list.slice()
  next[index] = item
  return next
}

/** Reducer puro: toda mutación del estado financiero pasa por aquí. */
export function financeReducer(state: FinanceState, action: FinanceAction): FinanceState {
  switch (action.type) {
    case "transaction/add":
      return { ...state, transactions: upsert(state.transactions, action.transaction) }

    case "transaction/remove":
      return { ...state, transactions: state.transactions.filter((t) => t.id !== action.id) }

    case "category/upsert":
      return { ...state, categories: upsert(state.categories, action.category) }

    case "category/setLimit":
      return {
        ...state,
        categories: state.categories.map((c) =>
          c.id === action.id ? { ...c, monthlyLimit: Math.max(0, action.limit) } : c
        ),
      }

    case "category/remove": {
      const category = state.categories.find((c) => c.id === action.id)
      if (!category || category.system) return state
      // Lo registrado en la categoría borrada pasa a la categoría "Otros" de su tipo.
      const fallback = FALLBACK_CATEGORY[category.kind]
      const reassign = <T extends { categoryId: string }>(item: T): T =>
        item.categoryId === action.id ? { ...item, categoryId: fallback } : item
      return {
        ...state,
        categories: state.categories.filter((c) => c.id !== action.id),
        transactions: state.transactions.map(reassign),
        recurring: state.recurring.map(reassign),
      }
    }

    case "recurring/upsert":
      return { ...state, recurring: upsert(state.recurring, action.item) }

    case "recurring/remove":
      // Los movimientos ya registrados se conservan (son historia real).
      return { ...state, recurring: state.recurring.filter((r) => r.id !== action.id) }

    case "goal/upsert":
      return { ...state, goals: upsert(state.goals, action.goal) }

    case "goal/remove":
      return {
        ...state,
        goals: state.goals.filter((g) => g.id !== action.id),
        goalMovements: state.goalMovements.filter((m) => m.goalId !== action.id),
      }

    case "goal/restore":
      return {
        ...state,
        goals: upsert(state.goals, action.goal),
        goalMovements: action.movements.reduce(upsert, state.goalMovements),
      }

    case "goal/move":
      // upsert (no push): aplicar la misma acción dos veces no duplica el abono.
      return { ...state, goalMovements: upsert(state.goalMovements, action.movement) }

    case "state/replace":
      return action.state

    default: {
      const exhaustive: never = action
      return exhaustive
    }
  }
}
