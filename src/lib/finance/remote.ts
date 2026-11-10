/**
 * Acceso a datos remoto (Supabase).
 *
 * - Mapea filas de la base (snake_case) ↔ modelo de la app (camelCase).
 * - Traduce cada acción del reducer a la operación SQL equivalente.
 * - Toda consulta pasa por RLS: solo se leen/escriben filas del usuario logueado.
 */
import type { PostgrestError } from "@supabase/supabase-js"

import type {
  CategoryRow,
  GoalMovementRow,
  GoalRow,
  Json,
  RecurringRow,
  TransactionRow,
} from "@/lib/supabase/database.types"
import { getSupabase } from "@/lib/supabase/client"

import type { FinanceAction } from "./reducer"
import type {
  Category,
  CategoryColor,
  FinanceState,
  GoalMovement,
  RecurringItem,
  SavingsGoal,
  Transaction,
  TransactionType,
} from "./types"

/* ----------------------------------------------------------------------------
 * Mappers fila ↔ dominio
 * ------------------------------------------------------------------------- */

const toCategory = (r: CategoryRow): Category => ({
  id: r.id,
  name: r.name,
  icon: r.icon,
  color: r.color as CategoryColor,
  kind: r.kind as TransactionType,
  monthlyLimit: Number(r.monthly_limit),
  ...(r.system ? { system: true } : {}),
})

const fromCategory = (userId: string, c: Category) => ({
  user_id: userId,
  id: c.id,
  name: c.name,
  icon: c.icon,
  color: c.color,
  kind: c.kind,
  monthly_limit: c.monthlyLimit,
  system: c.system ?? false,
})

const toRecurring = (r: RecurringRow): RecurringItem => ({
  id: r.id,
  description: r.description,
  amount: Number(r.amount),
  type: r.type as TransactionType,
  categoryId: r.category_id,
  dayOfMonth: r.day_of_month,
  active: r.active,
  autoRegister: r.auto_register,
  lastAutoMonth: r.last_auto_month,
})

const fromRecurring = (userId: string, r: RecurringItem) => ({
  user_id: userId,
  id: r.id,
  description: r.description,
  amount: r.amount,
  type: r.type,
  category_id: r.categoryId,
  day_of_month: r.dayOfMonth,
  active: r.active,
  auto_register: r.autoRegister ?? false,
  last_auto_month: r.lastAutoMonth ?? null,
})

const toTransaction = (r: TransactionRow): Transaction => ({
  id: r.id,
  description: r.description,
  amount: Number(r.amount),
  type: r.type as TransactionType,
  categoryId: r.category_id,
  date: r.date,
  ...(r.recurring_id ? { recurringId: r.recurring_id } : {}),
  createdAt: Date.parse(r.created_at),
})

const fromTransaction = (userId: string, t: Transaction) => ({
  user_id: userId,
  id: t.id,
  description: t.description,
  amount: t.amount,
  type: t.type,
  category_id: t.categoryId,
  date: t.date,
  recurring_id: t.recurringId ?? null,
  created_at: new Date(t.createdAt).toISOString(),
})

const toGoal = (r: GoalRow): SavingsGoal => ({
  id: r.id,
  name: r.name,
  icon: r.icon,
  color: r.color as CategoryColor,
  targetAmount: Number(r.target_amount),
  monthlyContribution: Number(r.monthly_contribution),
  deadline: r.deadline,
  createdAt: Date.parse(r.created_at),
})

const fromGoal = (userId: string, g: SavingsGoal) => ({
  user_id: userId,
  id: g.id,
  name: g.name,
  icon: g.icon,
  color: g.color,
  target_amount: g.targetAmount,
  monthly_contribution: g.monthlyContribution,
  deadline: g.deadline,
  created_at: new Date(g.createdAt).toISOString(),
})

const toGoalMovement = (r: GoalMovementRow): GoalMovement => ({
  id: r.id,
  goalId: r.goal_id,
  amount: Number(r.amount),
  date: r.date,
})

const fromGoalMovement = (userId: string, m: GoalMovement) => ({
  user_id: userId,
  id: m.id,
  goal_id: m.goalId,
  amount: m.amount,
  date: m.date,
})

/* ----------------------------------------------------------------------------
 * Errores
 * ------------------------------------------------------------------------- */

/**
 * Error de una operación remota, con lo necesario para decidir si reintentar.
 *  - status 0: no hubo respuesta (sin internet, DNS, timeout) → reintentar.
 *  - 401/408/429/502/503/504: problemas transitorios → reintentar (con límite).
 *  - Resto (400, 403, 409…): el servidor RECHAZÓ el dato → no tiene sentido reintentar.
 */
export class RemoteError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = "RemoteError"
  }

  get isNetwork() {
    return this.status === 0
  }

  get isRetryable() {
    return this.isNetwork || [401, 408, 429, 502, 503, 504].includes(this.status)
  }
}

/** Convierte un error de PostgREST en un RemoteError con mensaje legible. */
function raise(error: PostgrestError, status: number): never {
  throw new RemoteError(error.message || "Error de base de datos", status, error.code ?? "", { cause: error })
}

function check<T extends { error: PostgrestError | null; status: number }>(result: T): T {
  if (result.error) raise(result.error, result.status)
  return result
}

/* ----------------------------------------------------------------------------
 * Lectura
 * ------------------------------------------------------------------------- */

/** Supabase devuelve como máximo 1000 filas por consulta: se pagina hasta traer todo. */
const PAGE_SIZE = 1000

async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null; status: number }>
): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error, status } = await page(from, from + PAGE_SIZE - 1)
    if (error) raise(error, status)
    all.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) return all
  }
}

export async function fetchFinanceState(): Promise<FinanceState> {
  const sb = getSupabase()
  // Las 5 tablas en paralelo; el orden por id hace estable la paginación.
  const [categories, recurring, transactions, goals, goalMovements] = await Promise.all([
    fetchAllRows((a, b) => sb.from("categories").select("*").order("created_at").order("id").range(a, b)),
    fetchAllRows((a, b) => sb.from("recurring_items").select("*").order("id").range(a, b)),
    fetchAllRows((a, b) => sb.from("transactions").select("*").order("id").range(a, b)),
    fetchAllRows((a, b) => sb.from("savings_goals").select("*").order("created_at").order("id").range(a, b)),
    fetchAllRows((a, b) => sb.from("goal_movements").select("*").order("id").range(a, b)),
  ])

  return {
    version: 1,
    categories: categories.map(toCategory),
    recurring: recurring.map(toRecurring),
    transactions: transactions.map(toTransaction),
    goals: goals.map(toGoal),
    goalMovements: goalMovements.map(toGoalMovement),
  }
}

/** Crea las categorías base de un usuario nuevo (idempotente: ignora las existentes). */
export async function ensureCategories(userId: string, categories: Category[]) {
  check(
    await getSupabase()
      .from("categories")
      .upsert(
        // created_at explícito y creciente: conserva el orden de la lista.
        categories.map((c, i) => ({ ...fromCategory(userId, c), created_at: new Date(Date.now() + i).toISOString() })),
        { onConflict: "user_id,id", ignoreDuplicates: true }
      )
  )
}

/* ----------------------------------------------------------------------------
 * Escritura: una acción del reducer → una operación remota
 * ------------------------------------------------------------------------- */

const UPSERT = { onConflict: "user_id,id" } as const

export async function persistAction(userId: string, action: FinanceAction): Promise<void> {
  const sb = getSupabase()

  switch (action.type) {
    case "transaction/add":
      check(await sb.from("transactions").upsert(fromTransaction(userId, action.transaction), UPSERT))
      return
    case "transaction/remove":
      check(await sb.from("transactions").delete().eq("id", action.id))
      return

    case "category/upsert":
      check(await sb.from("categories").upsert(fromCategory(userId, action.category), UPSERT))
      return
    case "category/setLimit":
      check(await sb.from("categories").update({ monthly_limit: Math.max(0, action.limit) }).eq("id", action.id))
      return
    case "category/remove":
      // Reasignar + borrar en una sola transacción (función SQL).
      check(await sb.rpc("delete_category", { p_id: action.id }))
      return

    case "recurring/upsert":
      check(await sb.from("recurring_items").upsert(fromRecurring(userId, action.item), UPSERT))
      return
    case "recurring/remove":
      check(await sb.from("recurring_items").delete().eq("id", action.id))
      return

    case "goal/upsert":
      check(await sb.from("savings_goals").upsert(fromGoal(userId, action.goal), UPSERT))
      return
    case "goal/remove":
      // Los movimientos de la meta se borran por ON DELETE CASCADE.
      check(await sb.from("savings_goals").delete().eq("id", action.id))
      return
    case "goal/restore":
      check(await sb.from("savings_goals").upsert(fromGoal(userId, action.goal), UPSERT))
      if (action.movements.length) {
        check(await sb.from("goal_movements").upsert(action.movements.map((m) => fromGoalMovement(userId, m)), UPSERT))
      }
      return
    case "goal/move":
      // upsert (no insert): si un reintento llega dos veces, no falla ni duplica.
      check(await sb.from("goal_movements").upsert(fromGoalMovement(userId, action.movement), UPSERT))
      return

    case "state/replace":
      // Reemplazo total, atómico en el servidor.
      check(await sb.rpc("replace_my_data", { p_data: action.state as unknown as Json }))
      return

    default: {
      const exhaustive: never = action
      throw new Error(`Acción sin persistencia: ${JSON.stringify(exhaustive)}`)
    }
  }
}

/* ----------------------------------------------------------------------------
 * Cuenta
 * ------------------------------------------------------------------------- */

export async function deleteMyAccount() {
  check(await getSupabase().rpc("delete_my_account"))
}
