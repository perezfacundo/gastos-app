/**
 * Caché local por usuario en IndexedDB (sobrevive a cerrar la app):
 *  - snapshot: últimos datos CONFIRMADOS por el servidor → la app abre sin señal.
 *  - outbox:   cambios hechos en este dispositivo que todavía no llegaron al servidor.
 *
 * IndexedDB (y no localStorage) porque admite mucho más volumen y no bloquea la UI.
 * Si no está disponible (navegación privada en algunos navegadores), todo es no-op:
 * la app funciona igual, solo que sin soporte offline.
 */
import { createStore, del, get, set, type UseStore } from "idb-keyval"

import type { FinanceAction } from "./reducer"
import type { FinanceState } from "./types"

export interface OutboxEntry {
  id: string
  action: FinanceAction
  /** Reintentos fallidos por errores transitorios (no cuenta la falta de red). */
  attempts: number
  createdAt: number
}

let store: UseStore | null | undefined

function getStore(): UseStore | null {
  if (store === undefined) {
    store = typeof indexedDB === "undefined" ? null : createStore("gastos-app", "offline-cache")
  }
  return store
}

const snapshotKey = (userId: string) => `snapshot:${userId}`
const outboxKey = (userId: string) => `outbox:${userId}`

/** Nunca lanza: un fallo de caché no debe romper la app. */
async function safe<T>(fn: (s: UseStore) => Promise<T>, fallback: T): Promise<T> {
  const s = getStore()
  if (!s) return fallback
  try {
    return await fn(s)
  } catch (error) {
    console.warn("[offline-cache]", error)
    return fallback
  }
}

export async function loadCache(userId: string): Promise<{ snapshot: FinanceState | null; outbox: OutboxEntry[] }> {
  const [snapshot, outbox] = await Promise.all([
    safe((s) => get<FinanceState>(snapshotKey(userId), s), undefined),
    safe((s) => get<OutboxEntry[]>(outboxKey(userId), s), undefined),
  ])
  return { snapshot: snapshot ?? null, outbox: Array.isArray(outbox) ? outbox : [] }
}

export const saveSnapshot = (userId: string, snapshot: FinanceState) =>
  safe((s) => set(snapshotKey(userId), snapshot, s), undefined)

export const saveOutbox = (userId: string, outbox: OutboxEntry[]) =>
  safe((s) => set(outboxKey(userId), outbox, s), undefined)

/** Al cerrar sesión o eliminar la cuenta: no dejar datos financieros en el dispositivo. */
export const clearUserCache = (userId: string) =>
  safe(async (s) => {
    await del(snapshotKey(userId), s)
    await del(outboxKey(userId), s)
  }, undefined)
