/**
 * Datos de la versión anterior (sin cuentas), guardados en localStorage.
 * Al iniciar sesión, si la cuenta está vacía, se ofrece importarlos.
 */
import { FINANCE_CONFIG } from "./config"
import { isValidISODate } from "./format"
import type { FinanceState } from "./types"

const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0
const isPositive = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0

/** Validación defensiva: descarta registros corruptos en lugar de romper la importación. */
export function sanitizeState(raw: unknown): FinanceState | null {
  if (!raw || typeof raw !== "object") return null
  const data = raw as Partial<FinanceState>
  if (data.version !== 1 || !Array.isArray(data.categories) || data.categories.length === 0) return null

  const categories = data.categories.filter((c) => isNonEmptyString(c?.id) && isNonEmptyString(c?.name))
  const categoryIds = new Set(categories.map((c) => c.id))
  const goals = (data.goals ?? []).filter((g) => isNonEmptyString(g?.id) && isPositive(g?.targetAmount))
  const goalIds = new Set(goals.map((g) => g.id))

  return {
    version: 1,
    categories,
    transactions: (data.transactions ?? []).filter(
      (t) => isNonEmptyString(t?.id) && isPositive(t?.amount) && isValidISODate(t?.date) && categoryIds.has(t.categoryId)
    ),
    recurring: (data.recurring ?? []).filter(
      (r) => isNonEmptyString(r?.id) && isPositive(r?.amount) && categoryIds.has(r.categoryId)
    ),
    goals,
    goalMovements: (data.goalMovements ?? []).filter(
      (m) => isNonEmptyString(m?.id) && goalIds.has(m.goalId) && typeof m.amount === "number" && m.amount !== 0 && isValidISODate(m.date)
    ),
  }
}

/** Tiene algo que valga la pena importar (no solo categorías). */
export const hasUserData = (s: FinanceState) =>
  s.transactions.length > 0 || s.recurring.length > 0 || s.goals.length > 0

export function readLegacyState(): FinanceState | null {
  try {
    const raw = window.localStorage.getItem(FINANCE_CONFIG.storageKey)
    if (!raw) return null
    const state = sanitizeState(JSON.parse(raw))
    return state && hasUserData(state) ? state : null
  } catch {
    return null
  }
}

export function clearLegacyState() {
  try {
    window.localStorage.removeItem(FINANCE_CONFIG.storageKey)
  } catch {
    /* almacenamiento bloqueado: nada que limpiar */
  }
}
