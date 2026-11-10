/**
 * Store de datos financieros: Supabase + soporte sin conexión (patrón "outbox").
 *
 *   dispatch(action)
 *     1. Aplica el reducer en memoria → la UI cambia al instante (optimista).
 *     2. Agrega la acción a la OUTBOX (cola persistida en IndexedDB).
 *     3. flush() la envía a Supabase, en orden, una por vez:
 *        - éxito                  → sale de la cola; se actualiza la copia "confirmada".
 *        - sin red / transitorio  → queda en la cola; se reintenta (online, foco, backoff).
 *        - rechazo del servidor   → sale de la cola; se avisa y se reconstruye el estado
 *                                   desde el servidor (se deshace el cambio en pantalla).
 *
 * Dos copias del estado:
 *   - `confirmed`: lo último que el servidor confirmó (se guarda como snapshot local).
 *   - `data`:      confirmed + acciones pendientes de la outbox (lo que ve el usuario).
 *
 * Todas las acciones son idempotentes (upsert/delete), así que reintentar o
 * re-aplicar una acción nunca duplica datos.
 */
import { createEmptyState } from "./mock-data"
import { clearLegacyState, hasUserData, readLegacyState } from "./legacy"
import { clearUserCache, loadCache, saveOutbox, saveSnapshot, type OutboxEntry } from "./offline-cache"
import { ensureCategories, fetchFinanceState, persistAction, RemoteError } from "./remote"
import { financeReducer, type FinanceAction } from "./reducer"
import type { FinanceState } from "./types"
import { generateId } from "./format"

type Listener = () => void

export interface FinanceMeta {
  status: "idle" | "loading" | "ready" | "error"
  userId: string | null
  error: string | null
  /** Cambios locales que todavía no llegaron al servidor. */
  queued: number
  /** El último intento de comunicarse con el servidor falló por falta de red. */
  offline: boolean
  /** Datos de la versión local anterior (sin cuentas), si se pueden importar. */
  legacy: FinanceState | null
  /** Ya se recibieron datos frescos del servidor en esta sesión (no solo la copia local). */
  synced: boolean
}

const INITIAL_META: FinanceMeta = {
  status: "idle",
  userId: null,
  error: null,
  queued: 0,
  offline: false,
  legacy: null,
  synced: false,
}
/** Reintentos máximos ante errores transitorios del servidor (la falta de red se reintenta siempre). */
const MAX_ATTEMPTS = 8
/** Si la pestaña vuelve a estar visible tras este tiempo, se recargan los datos (otros dispositivos). */
const RESYNC_AFTER_MS = 30_000

let confirmed: FinanceState | null = null
let data: FinanceState | null = null
let outbox: OutboxEntry[] = []
let meta: FinanceMeta = INITIAL_META
let generation = 0 // se incrementa al cambiar de usuario: invalida trabajo en vuelo
let flushing = false
/** La cola espera a la primera respuesta del servidor (ver load). */
let initialSyncDone = false
let retryTimer: ReturnType<typeof setTimeout> | null = null
let lastSyncAt = 0
let errorHandler: ((message: string) => void) | null = null
/** Promesas de dispatch() esperando la confirmación del servidor. */
const waiters = new Map<string, { resolve: () => void; reject: (error: unknown) => void }>()

const listeners = new Set<Listener>()
const emit = () => listeners.forEach((l) => l())

function setMeta(patch: Partial<FinanceMeta>) {
  meta = { ...meta, ...patch } // objeto nuevo: useSyncExternalStore detecta el cambio
  emit()
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))
const isNetworkError = (error: unknown) => error instanceof RemoteError && error.isNetwork
const isRetryable = (error: unknown) => error instanceof RemoteError && error.isRetryable

/** Estado visible = confirmado + acciones pendientes (re-aplicadas en orden). */
const applyOutbox = (base: FinanceState) => outbox.reduce((s, e) => financeReducer(s, e.action), base)

function persistQueue() {
  if (meta.userId) void saveOutbox(meta.userId, outbox)
  setMeta({ queued: outbox.length })
}

function scheduleRetry(attempt: number) {
  if (retryTimer) clearTimeout(retryTimer)
  const delay = Math.min(60_000, 2_000 * 2 ** Math.min(attempt, 5)) // 2s, 4s, 8s… máx 1 min
  retryTimer = setTimeout(() => void financeStore.flush(), delay)
}

/** Trae todo del servidor y reconstruye el estado visible (con lo pendiente encima). */
async function syncFromServer(gen: number) {
  const fresh = await fetchFinanceState()
  if (gen !== generation || !meta.userId) return
  confirmed = fresh
  data = applyOutbox(fresh)
  lastSyncAt = Date.now()
  void saveSnapshot(meta.userId, fresh)
  setMeta({ status: "ready", error: null, offline: false, synced: true })
}

/* --------------------------- eventos del navegador --------------------------- */

function onOnline() {
  if (meta.status !== "ready") return
  // Primero se envía lo pendiente; después se trae lo que cambió en otros dispositivos.
  void financeStore.flush().then(() => {
    if (!outbox.length) syncFromServer(generation).catch(() => undefined)
  })
}

/** El sistema avisa que se perdió la red (modo avión, sin wifi): se muestra al instante. */
function onOffline() {
  if (meta.status === "ready") setMeta({ offline: true })
}

function onVisibilityChange() {
  if (document.visibilityState !== "visible" || meta.status !== "ready") return
  if (outbox.length) {
    void financeStore.flush()
  } else if (Date.now() - lastSyncAt > RESYNC_AFTER_MS) {
    syncFromServer(generation).catch(() => {
      /* silencioso: se reintenta en la próxima visita a la pestaña */
    })
  }
}

export const financeStore = {
  /* ---------------------- contrato de useSyncExternalStore ---------------------- */
  getSnapshot: (): FinanceState | null => (meta.status === "ready" ? data : null),
  getServerSnapshot: (): FinanceState | null => null,
  getMeta: (): FinanceMeta => meta,
  getServerMeta: (): FinanceMeta => INITIAL_META,

  subscribe(listener: Listener) {
    listeners.add(listener)
    if (listeners.size === 1 && typeof window !== "undefined") {
      window.addEventListener("online", onOnline)
      window.addEventListener("offline", onOffline)
      document.addEventListener("visibilitychange", onVisibilityChange)
    }
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0 && typeof window !== "undefined") {
        window.removeEventListener("online", onOnline)
        window.removeEventListener("offline", onOffline)
        document.removeEventListener("visibilitychange", onVisibilityChange)
      }
    }
  },

  /** Función que la UI usa para mostrar rechazos del servidor (toasts). */
  setErrorHandler(handler: ((message: string) => void) | null) {
    errorHandler = handler
  },

  /* ------------------------------- ciclo de vida ------------------------------- */

  /**
   * Carga los datos del usuario con "stale-while-revalidate":
   *  1. Si hay copia local, la muestra AL INSTANTE (la app abre rápido, con o sin red).
   *  2. En paralelo pide los datos frescos al servidor y los reemplaza al llegar.
   *  3. Recién entonces envía la cola pendiente (evita que un cambio "parpadee").
   * Sin red y sin copia local: error (no se inventan datos).
   */
  async load(userId: string, { force = false } = {}) {
    if (!force && meta.userId === userId && meta.status !== "idle" && meta.status !== "error") return
    const gen = ++generation
    confirmed = data = null
    initialSyncDone = false
    setMeta({ ...INITIAL_META, status: "loading", userId })

    const cache = await loadCache(userId)
    if (gen !== generation) return
    outbox = cache.outbox

    if (cache.snapshot) {
      confirmed = cache.snapshot
      data = applyOutbox(confirmed)
      setMeta({
        status: "ready",
        queued: outbox.length,
        // Pista inmediata del sistema operativo (no es infalible: con "wifi sin internet" dice online).
        offline: typeof navigator !== "undefined" && navigator.onLine === false,
        legacy: hasUserData(data) ? null : readLegacyState(),
      })
    }

    try {
      let remote = await fetchFinanceState()
      // Usuario nuevo: se crean las categorías base (sin límites ni movimientos).
      if (remote.categories.length === 0) {
        const { categories } = createEmptyState()
        await ensureCategories(userId, categories)
        remote = { ...remote, categories }
      }
      if (gen !== generation) return
      confirmed = remote
      data = applyOutbox(remote)
      lastSyncAt = Date.now()
      void saveSnapshot(userId, remote)
      setMeta({
        status: "ready",
        error: null,
        offline: false,
        synced: true,
        queued: outbox.length,
        legacy: hasUserData(data) ? null : readLegacyState(),
      })
    } catch (error) {
      if (gen !== generation) return
      if (!cache.snapshot) {
        setMeta({ status: "error", error: messageOf(error) })
        return
      }
      // Seguimos con la copia local; se reintenta al volver la red o el foco.
      setMeta({ offline: isNetworkError(error) })
    } finally {
      if (gen === generation) initialSyncDone = true
    }

    void financeStore.flush()
  },

  /** Al cerrar sesión: olvida la memoria y (por privacidad) la copia local del dispositivo. */
  async reset({ clearCache = true } = {}) {
    const userId = meta.userId
    generation++
    flushing = false // un flush en vuelo del usuario anterior ya no cuenta
    initialSyncDone = false
    if (retryTimer) clearTimeout(retryTimer)
    confirmed = data = null
    outbox = []
    waiters.forEach((w) => w.reject(new Error("Sesión cerrada")))
    waiters.clear()
    setMeta(INITIAL_META)
    if (clearCache && userId) await clearUserCache(userId)
  },

  /* --------------------------------- escritura --------------------------------- */

  /**
   * Aplica la acción en memoria y la encola. La promesa se resuelve cuando el
   * servidor la confirma (o se rechaza si la descarta). Los llamadores pueden ignorarla.
   */
  dispatch(action: FinanceAction): Promise<void> {
    if (!data || !meta.userId || meta.status !== "ready") {
      return Promise.reject(new Error("Los datos todavía no están cargados"))
    }
    const next = financeReducer(data, action)
    if (next === data) return Promise.resolve()

    data = next
    const entry: OutboxEntry = { id: generateId(), action, attempts: 0, createdAt: Date.now() }
    outbox = [...outbox, entry]
    persistQueue()

    const confirmation = new Promise<void>((resolve, reject) => waiters.set(entry.id, { resolve, reject }))
    void financeStore.flush()
    return confirmation
  },

  /** Envía la outbox al servidor en orden. Seguro de llamar muchas veces. */
  async flush() {
    if (flushing || !initialSyncDone || !meta.userId || meta.status !== "ready") return
    flushing = true
    const gen = generation
    const userId = meta.userId
    let rejected = false

    try {
      while (outbox.length && gen === generation) {
        const entry = outbox[0]
        try {
          await persistAction(userId, entry.action)
        } catch (error) {
          if (gen !== generation) return
          const network = isNetworkError(error)
          if (network || (isRetryable(error) && entry.attempts < MAX_ATTEMPTS)) {
            // Queda en la cola: se reintenta más tarde.
            if (!network) outbox = outbox.map((e) => (e.id === entry.id ? { ...e, attempts: e.attempts + 1 } : e))
            persistQueue()
            setMeta({ offline: network })
            scheduleRetry(entry.attempts)
            return
          }
          // Rechazo definitivo: se descarta y luego se reconstruye desde el servidor.
          outbox = outbox.slice(1)
          persistQueue()
          rejected = true
          waiters.get(entry.id)?.reject(error)
          waiters.delete(entry.id)
          errorHandler?.(messageOf(error))
          continue
        }

        // Confirmado por el servidor.
        if (gen !== generation) return
        outbox = outbox.slice(1)
        confirmed = financeReducer(confirmed!, entry.action)
        void saveSnapshot(userId, confirmed)
        persistQueue()
        if (meta.offline) setMeta({ offline: false })
        waiters.get(entry.id)?.resolve()
        waiters.delete(entry.id)
      }

      if (rejected && gen === generation) {
        await syncFromServer(gen).catch((error) => {
          // Sin poder recargar: se vuelve al último estado confirmado conocido.
          data = applyOutbox(confirmed!)
          setMeta({ offline: isNetworkError(error) })
        })
      }
    } finally {
      if (gen === generation) flushing = false
    }
  },

  /* ------------------------- importación de datos locales ------------------------- */

  async importLegacy() {
    const legacy = meta.legacy
    if (!legacy) return
    await financeStore.dispatch({ type: "state/replace", state: legacy })
    clearLegacyState() // solo se borra lo local cuando el servidor lo confirmó
    setMeta({ legacy: null })
  },

  dismissLegacy() {
    clearLegacyState()
    setMeta({ legacy: null })
  },
}
