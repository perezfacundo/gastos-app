/**
 * Tests del store con Supabase e IndexedDB simulados (mocks).
 * Cubren lo crítico: sin conexión nunca se pierde un cambio, el orden se
 * respeta, y un rechazo del servidor deshace el cambio en pantalla.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createEmptyState } from "./mock-data"
import type { OutboxEntry } from "./offline-cache"
import type { FinanceAction } from "./reducer"
import type { FinanceState, Transaction } from "./types"

/* ---------------------------------- mocks ---------------------------------- */

// Supabase: controlamos qué responde cada llamada. RemoteError es la clase real.
vi.mock("./remote", async (importOriginal) => {
  const original = await importOriginal<typeof import("./remote")>()
  return {
    ...original,
    fetchFinanceState: vi.fn(),
    persistAction: vi.fn(),
    ensureCategories: vi.fn(),
  }
})

// IndexedDB: un Map en memoria.
const cache = new Map<string, unknown>()
vi.mock("./offline-cache", () => ({
  loadCache: vi.fn(async (userId: string) => ({
    snapshot: (cache.get(`snapshot:${userId}`) as FinanceState | undefined) ?? null,
    outbox: (cache.get(`outbox:${userId}`) as OutboxEntry[] | undefined) ?? [],
  })),
  saveSnapshot: vi.fn(async (userId: string, s: FinanceState) => void cache.set(`snapshot:${userId}`, s)),
  saveOutbox: vi.fn(async (userId: string, o: OutboxEntry[]) => void cache.set(`outbox:${userId}`, o)),
  clearUserCache: vi.fn(async (userId: string) => {
    cache.delete(`snapshot:${userId}`)
    cache.delete(`outbox:${userId}`)
  }),
}))

// Sin localStorage en Node: no hay datos de la versión anterior.
vi.mock("./legacy", () => ({
  readLegacyState: () => null,
  clearLegacyState: () => undefined,
  hasUserData: (s: FinanceState) => s.transactions.length > 0,
}))

const { fetchFinanceState, persistAction, RemoteError } = await import("./remote")
const { financeStore } = await import("./store")

/* --------------------------------- helpers --------------------------------- */

const USER = "user-1"
const serverState = (): FinanceState => createEmptyState()

const tx = (id: string, amount = 100): Transaction => ({
  id,
  description: `Gasto ${id}`,
  amount,
  type: "expense",
  categoryId: "alimentacion",
  date: "2026-11-09",
  createdAt: 1,
})
const add = (t: Transaction): FinanceAction => ({ type: "transaction/add", transaction: t })

const networkError = () => new RemoteError("TypeError: Failed to fetch", 0, "")
const serverRejection = () => new RemoteError("new row violates check constraint", 400, "23514")

const visibleIds = () => financeStore.getSnapshot()?.transactions.map((t) => t.id) ?? []
/** Deja correr las promesas pendientes. */
const settle = () => new Promise((r) => setImmediate(r))

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }) // los reintentos no corren solos
  await financeStore.reset({ clearCache: false })
  cache.clear()
  vi.mocked(fetchFinanceState).mockReset().mockResolvedValue(serverState())
  vi.mocked(persistAction).mockReset().mockResolvedValue(undefined)
})

afterEach(() => {
  financeStore.setErrorHandler(null)
  vi.useRealTimers()
})

/* ---------------------------------- tests ---------------------------------- */

describe("con conexión", () => {
  it("aplica el cambio al instante y lo confirma en el servidor", async () => {
    await financeStore.load(USER)
    const saved = financeStore.dispatch(add(tx("a")))

    expect(visibleIds()).toEqual(["a"]) // optimista: antes de que responda el servidor
    await saved
    expect(persistAction).toHaveBeenCalledWith(USER, add(tx("a")))
    expect(financeStore.getMeta().queued).toBe(0)
    expect(cache.get(`outbox:${USER}`)).toEqual([])
  })
})

describe("sin conexión", () => {
  it("conserva el cambio, lo guarda en la cola y lo envía al volver la red", async () => {
    await financeStore.load(USER)
    vi.mocked(persistAction).mockRejectedValueOnce(networkError())

    const saved = financeStore.dispatch(add(tx("a")))
    await settle()

    // El gasto sigue en pantalla y en la cola persistida.
    expect(visibleIds()).toEqual(["a"])
    expect(financeStore.getMeta()).toMatchObject({ offline: true, queued: 1 })
    expect((cache.get(`outbox:${USER}`) as OutboxEntry[]).map((e) => e.action)).toEqual([add(tx("a"))])

    // Vuelve la red.
    await financeStore.flush()
    await saved
    expect(financeStore.getMeta()).toMatchObject({ offline: false, queued: 0 })
    expect(visibleIds()).toEqual(["a"])
  })

  it("envía los cambios pendientes en el mismo orden en que se hicieron", async () => {
    await financeStore.load(USER)
    vi.mocked(persistAction).mockRejectedValue(networkError()) // sin red hasta nuevo aviso

    void financeStore.dispatch(add(tx("a")))
    await settle()
    void financeStore.dispatch(add(tx("b")))
    await settle()
    void financeStore.dispatch({ type: "transaction/remove", id: "a" })
    await settle()
    expect(financeStore.getMeta().queued).toBe(3)
    expect(visibleIds()).toEqual(["b"])

    // Vuelve la red: solo cuentan los envíos exitosos (desde acá).
    vi.mocked(persistAction).mockReset().mockResolvedValue(undefined)
    await financeStore.flush()
    const sent = vi.mocked(persistAction).mock.calls.map(([, action]) =>
      action.type === "transaction/add" ? `add:${action.transaction.id}` : action.type === "transaction/remove" ? `remove:${action.id}` : action.type
    )
    expect(sent).toEqual(["add:a", "add:b", "remove:a"])
    expect(financeStore.getMeta().queued).toBe(0)
    expect(visibleIds()).toEqual(["b"])
  })

  it("abre la app sin red usando la copia local y los cambios pendientes", async () => {
    cache.set(`snapshot:${USER}`, { ...serverState(), transactions: [tx("viejo")] })
    cache.set(`outbox:${USER}`, [{ id: "e1", action: add(tx("nuevo")), attempts: 0, createdAt: 1 }])
    vi.mocked(fetchFinanceState).mockRejectedValue(networkError())
    vi.mocked(persistAction).mockRejectedValue(networkError())

    await financeStore.load(USER)

    expect(financeStore.getMeta()).toMatchObject({ status: "ready", offline: true, queued: 1 })
    expect(visibleIds().sort()).toEqual(["nuevo", "viejo"])
  })

  it("con copia local abre AL INSTANTE y luego muestra los datos frescos del servidor", async () => {
    cache.set(`snapshot:${USER}`, { ...serverState(), transactions: [tx("viejo")] })
    let respond!: (s: FinanceState) => void
    vi.mocked(fetchFinanceState).mockReturnValue(new Promise((r) => (respond = r)))

    const loading = financeStore.load(USER)
    await settle()
    // Todavía sin respuesta del servidor: ya se ve la copia local.
    expect(financeStore.getMeta().status).toBe("ready")
    expect(visibleIds()).toEqual(["viejo"])

    // Mientras tanto, el usuario carga un gasto: NO se envía hasta tener la respuesta.
    void financeStore.dispatch(add(tx("mientras")))
    await settle()
    expect(persistAction).not.toHaveBeenCalled()

    respond({ ...serverState(), transactions: [tx("fresco")] })
    await loading
    await settle()
    expect(visibleIds().sort()).toEqual(["fresco", "mientras"])
    expect(persistAction).toHaveBeenCalledOnce()
  })

  it("sin red y sin copia local muestra error (no inventa datos)", async () => {
    vi.mocked(fetchFinanceState).mockRejectedValue(networkError())
    await financeStore.load(USER)
    expect(financeStore.getMeta().status).toBe("error")
  })
})

describe("rechazos del servidor", () => {
  it("deshace el cambio, avisa y recarga desde el servidor", async () => {
    const onError = vi.fn()
    financeStore.setErrorHandler(onError)
    await financeStore.load(USER)
    vi.mocked(persistAction).mockRejectedValueOnce(serverRejection())

    const saved = financeStore.dispatch(add(tx("invalido")))
    await expect(saved).rejects.toThrow("check constraint")
    await settle()

    expect(onError).toHaveBeenCalledOnce()
    expect(visibleIds()).toEqual([]) // el cambio se deshizo
    expect(fetchFinanceState).toHaveBeenCalledTimes(2) // carga inicial + resincronización
    expect(financeStore.getMeta().queued).toBe(0)
  })

  it("un rechazo no bloquea los cambios que vienen detrás", async () => {
    financeStore.setErrorHandler(() => undefined)
    await financeStore.load(USER)
    vi.mocked(persistAction).mockRejectedValueOnce(serverRejection())
    vi.mocked(fetchFinanceState).mockResolvedValue({ ...serverState(), transactions: [tx("b")] })

    void financeStore.dispatch(add(tx("malo"))).catch(() => undefined)
    const ok = financeStore.dispatch(add(tx("b")))
    await ok
    await settle()

    expect(visibleIds()).toEqual(["b"])
  })

  it("errores transitorios (503) se reintentan y, superado el límite, se descartan", async () => {
    financeStore.setErrorHandler(() => undefined)
    await financeStore.load(USER)
    vi.mocked(persistAction).mockRejectedValue(new RemoteError("Service Unavailable", 503, ""))

    const saved = financeStore.dispatch(add(tx("a"))).catch((e: Error) => e)
    await settle()
    expect(financeStore.getMeta().queued).toBe(1) // sigue en la cola

    for (let i = 0; i < 10; i++) await financeStore.flush()
    expect(await saved).toBeInstanceOf(Error)
    expect(financeStore.getMeta().queued).toBe(0)
  })
})

describe("cerrar sesión", () => {
  it("borra la memoria y la copia local del dispositivo", async () => {
    await financeStore.load(USER)
    await financeStore.dispatch(add(tx("a")))
    expect(cache.has(`snapshot:${USER}`)).toBe(true)

    await financeStore.reset()
    expect(financeStore.getSnapshot()).toBeNull()
    expect(cache.has(`snapshot:${USER}`)).toBe(false)
  })
})
