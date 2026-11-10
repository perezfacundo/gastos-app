"use client"

import { useMemo, useSyncExternalStore } from "react"

import { goalProgress, monthPlan } from "@/lib/finance/calculations"
import { financeStore, type FinanceMeta } from "@/lib/finance/store"
import type { Category, FinanceState, MonthKey } from "@/lib/finance/types"

/**
 * Estado financiero del usuario. Devuelve `null` mientras carga (y en el
 * servidor); los componentes muestran un esqueleto.
 */
export function useFinanceState(): FinanceState | null {
  return useSyncExternalStore(financeStore.subscribe, financeStore.getSnapshot, financeStore.getServerSnapshot)
}

/** Estado de carga/guardado: status, error, escrituras pendientes, datos locales importables. */
export function useFinanceMeta(): FinanceMeta {
  return useSyncExternalStore(financeStore.subscribe, financeStore.getMeta, financeStore.getServerMeta)
}

/** Plan derivado del mes (memoizado: solo se recalcula si cambian estado o mes). */
export function useMonthPlan(state: FinanceState, month: MonthKey) {
  return useMemo(() => monthPlan(state, month), [state, month])
}

export function useGoalsProgress(state: FinanceState) {
  return useMemo(() => state.goals.map((goal) => goalProgress(state, goal)), [state])
}

/** Mapa id → categoría para búsquedas O(1) en listados. */
export function useCategoryMap(state: FinanceState) {
  return useMemo(() => new Map<string, Category>(state.categories.map((c) => [c.id, c])), [state.categories])
}
