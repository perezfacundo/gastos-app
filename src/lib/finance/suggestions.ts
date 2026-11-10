/**
 * Ayudas para cargar movimientos rápido, derivadas del historial del usuario.
 * Funciones puras: se testean sin UI (ver suggestions.test.ts).
 */
import { parseISODate, todayISO, toISODate } from "./format"
import type { Category, FinanceState, ISODate, TransactionType } from "./types"

/** "Supermercado " / "supermercado" / "SÚPER" → misma clave de comparación. */
export function normalizeText(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita tildes
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
}

function daysBefore(iso: ISODate, days: number): ISODate {
  const d = parseISODate(iso)
  d.setDate(d.getDate() - days)
  return toISODate(d)
}

/** Sin historial, estas son las categorías más probables para un gasto del día a día. */
const DAILY_PRIORITY = ["alimentacion", "transporte", "ocio", "salud", "otros"]
const priorityOf = (id: string) => {
  const i = DAILY_PRIORITY.indexOf(id)
  return i === -1 ? DAILY_PRIORITY.length : i
}

/**
 * Categorías de un tipo ordenadas por uso en los últimos `days` días.
 * Solo cuenta lo cargado a mano: los fijos (alquiler, sueldo) se registran solos
 * y no dicen nada de qué carga el usuario en el día a día.
 * Empates: categorías de gasto diario primero, luego el orden original.
 */
export function rankCategories(
  state: FinanceState,
  kind: TransactionType,
  { today = todayISO(), days = 90 }: { today?: ISODate; days?: number } = {}
): Category[] {
  const since = daysBefore(today, days)
  const counts = new Map<string, number>()
  for (const t of state.transactions) {
    if (t.type === kind && !t.recurringId && t.date >= since && t.date <= today) {
      counts.set(t.categoryId, (counts.get(t.categoryId) ?? 0) + 1)
    }
  }
  return state.categories
    .map((category, index) => ({ category, index, count: counts.get(category.id) ?? 0 }))
    .filter((x) => x.category.kind === kind)
    .sort((a, b) => b.count - a.count || priorityOf(a.category.id) - priorityOf(b.category.id) || a.index - b.index)
    .map((x) => x.category)
}

export interface DescriptionSuggestion {
  description: string
  categoryId: string
  /** Monto de la vez más reciente. */
  amount: number
  count: number
}

/**
 * Descripciones ya usadas que coinciden con lo que se está escribiendo.
 * Prioriza las que EMPIEZAN con el texto, luego las más frecuentes y recientes.
 */
export function descriptionSuggestions(
  state: FinanceState,
  kind: TransactionType,
  query: string,
  limit = 4
): DescriptionSuggestion[] {
  const q = normalizeText(query)
  if (!q) return []

  const groups = new Map<string, DescriptionSuggestion & { lastDate: string; lastCreated: number }>()
  for (const t of state.transactions) {
    if (t.type !== kind) continue
    const key = normalizeText(t.description)
    if (!key.includes(q) || key === q) continue // si ya escribió exactamente eso, no sugerir
    const current = groups.get(key)
    const isNewer = !current || t.date > current.lastDate || (t.date === current.lastDate && t.createdAt > current.lastCreated)
    groups.set(key, {
      description: isNewer ? t.description : current!.description,
      categoryId: isNewer ? t.categoryId : current!.categoryId,
      amount: isNewer ? t.amount : current!.amount,
      lastDate: isNewer ? t.date : current!.lastDate,
      lastCreated: isNewer ? t.createdAt : current!.lastCreated,
      count: (current?.count ?? 0) + 1,
    })
  }

  return [...groups.entries()]
    .sort(
      ([ka, a], [kb, b]) =>
        Number(kb.startsWith(q)) - Number(ka.startsWith(q)) || b.count - a.count || b.lastDate.localeCompare(a.lastDate)
    )
    .slice(0, limit)
    .map(([, s]) => ({ description: s.description, categoryId: s.categoryId, amount: s.amount, count: s.count }))
}
