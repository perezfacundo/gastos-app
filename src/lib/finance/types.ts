/**
 * Modelo de dominio de la app de planificación financiera.
 *
 * Convenciones:
 * - Montos: números positivos en la moneda configurada (el signo lo da `type`).
 * - Fechas: strings "YYYY-MM-DD" en hora local (evita desfasajes de zona horaria).
 * - Meses: strings "YYYY-MM" (MonthKey).
 */

export type TransactionType = "income" | "expense"

/** "YYYY-MM-DD" */
export type ISODate = string
/** "YYYY-MM" */
export type MonthKey = string

export type CategoryColor =
  | "blue"
  | "orange"
  | "aqua"
  | "yellow"
  | "magenta"
  | "green"
  | "violet"
  | "red"

export interface Category {
  id: string
  name: string
  /** Clave del registro de íconos (ver `category-icon.tsx`). */
  icon: string
  color: CategoryColor
  kind: TransactionType
  /** Límite de gasto mensual. Solo aplica a categorías de gasto; 0 = sin límite. */
  monthlyLimit: number
  /** Las categorías de sistema ("Otros") no se pueden borrar. */
  system?: boolean
}

export interface Transaction {
  id: string
  description: string
  amount: number
  type: TransactionType
  categoryId: string
  date: ISODate
  /** Si el movimiento proviene de un fijo/recurrente, su id. */
  recurringId?: string
  createdAt: number
}

/** Ingreso o gasto fijo que se repite todos los meses (alquiler, sueldo, suscripciones). */
export interface RecurringItem {
  id: string
  description: string
  amount: number
  type: TransactionType
  categoryId: string
  /** Día del mes en que vence/se cobra (1-31; se ajusta a meses más cortos). */
  dayOfMonth: number
  active: boolean
  /** Débito automático: se registra solo en su fecha (sin tocar "Pagar"). */
  autoRegister?: boolean
  /** Último mes ("YYYY-MM") registrado automáticamente: evita recrearlo si el usuario lo borra. */
  lastAutoMonth?: MonthKey | null
}

export interface SavingsGoal {
  id: string
  name: string
  icon: string
  color: CategoryColor
  targetAmount: number
  /** Aporte mensual planificado: se reserva en el plan de cada mes. */
  monthlyContribution: number
  deadline: ISODate | null
  createdAt: number
}

/** Abono (+) o retiro (−) de fondos de una meta. */
export interface GoalMovement {
  id: string
  goalId: string
  amount: number
  date: ISODate
}

export interface FinanceState {
  version: 1
  categories: Category[]
  transactions: Transaction[]
  recurring: RecurringItem[]
  goals: SavingsGoal[]
  goalMovements: GoalMovement[]
}

export type BudgetStatus = "ok" | "warning" | "over" | "unbudgeted"
