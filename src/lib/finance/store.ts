/**
 * Store externo + persistencia en localStorage.
 *
 * Se consume con `useSyncExternalStore` (ver hooks/use-finance.ts):
 * - En el servidor (y durante la hidratación) el snapshot es `null` → la UI
 *   muestra un esqueleto, sin desajustes de hidratación.
 * - En el cliente se lee localStorage de forma perezosa en el primer acceso.
 * - Cambios en otra pestaña se sincronizan mediante el evento `storage`.
 */
import { FINANCE_CONFIG } from "./config"
import { isValidISODate } from "./format"
import { createMockState } from "./mock-data"
import { financeReducer, type FinanceAction } from "./reducer"
import type { FinanceState } from "./types"

type Listener = () => void

let state: FinanceState | null = null
const listeners = new Set<Listener>()

const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0
const isPositive = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0

/** Validación defensiva: descarta registros corruptos en lugar de romper la app. */
function sanitize(raw: unknown): FinanceState | null {
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
      (m) => isNonEmptyString(m?.id) && goalIds.has(m.goalId) && typeof m.amount === "number" && isValidISODate(m.date)
    ),
  }
}

function load(): FinanceState {
  try {
    const raw = window.localStorage.getItem(FINANCE_CONFIG.storageKey)
    if (raw !== null) {
      const parsed = sanitize(JSON.parse(raw))
      if (parsed) return parsed
      console.warn("[finance] Datos guardados inválidos; se cargan datos de ejemplo.")
    }
  } catch (error) {
    console.warn("[finance] No se pudo leer localStorage:", error)
  }
  // Primera visita (o datos ilegibles): datos de ejemplo, persistidos para que sean estables.
  const seeded = createMockState()
  persist(seeded)
  return seeded
}

function persist(next: FinanceState) {
  try {
    window.localStorage.setItem(FINANCE_CONFIG.storageKey, JSON.stringify(next))
  } catch (error) {
    console.warn("[finance] No se pudo guardar en localStorage:", error)
  }
}

function emit() {
  for (const listener of listeners) listener()
}

function onStorage(event: StorageEvent) {
  if (event.key !== FINANCE_CONFIG.storageKey) return
  state = null // se vuelve a leer en el próximo getSnapshot
  emit()
}

export const financeStore = {
  getSnapshot(): FinanceState {
    if (state === null) state = load()
    return state
  },

  getServerSnapshot(): FinanceState | null {
    return null
  },

  subscribe(listener: Listener) {
    listeners.add(listener)
    if (listeners.size === 1) window.addEventListener("storage", onStorage)
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) window.removeEventListener("storage", onStorage)
    }
  },

  dispatch(action: FinanceAction) {
    const prev = financeStore.getSnapshot()
    const next = financeReducer(prev, action)
    if (next === prev) return
    state = next
    persist(next)
    emit()
  },
}
