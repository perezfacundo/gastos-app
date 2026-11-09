import { FINANCE_CONFIG } from "./config"
import type { ISODate, MonthKey } from "./types"

const currency = new Intl.NumberFormat(FINANCE_CONFIG.locale, {
  style: "currency",
  currency: FINANCE_CONFIG.currency,
  maximumFractionDigits: 0,
})

const currencyPrecise = new Intl.NumberFormat(FINANCE_CONFIG.locale, {
  style: "currency",
  currency: FINANCE_CONFIG.currency,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const percent = new Intl.NumberFormat(FINANCE_CONFIG.locale, {
  style: "percent",
  maximumFractionDigits: 0,
})

/** $ 1.234 (sin decimales: más legible en tableros). */
export const formatMoney = (value: number) => currency.format(Math.round(value))

/** $ 1.234,50 (para listados de movimientos). */
export const formatMoneyPrecise = (value: number) => currencyPrecise.format(value)

export const formatPercent = (ratio: number) => percent.format(Number.isFinite(ratio) ? ratio : 0)

/* ----------------------------------------------------------------------------
 * Fechas (siempre en hora local)
 * ------------------------------------------------------------------------- */

const pad = (n: number) => String(n).padStart(2, "0")

export function toISODate(date: Date): ISODate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export const todayISO = () => toISODate(new Date())

export function parseISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d)
}

export function isValidISODate(value: unknown): value is ISODate {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = parseISODate(value)
  return toISODate(date) === value
}

export const monthKeyOf = (iso: ISODate): MonthKey => iso.slice(0, 7)

export const currentMonthKey = (): MonthKey => monthKeyOf(todayISO())

export function shiftMonth(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split("-").map(Number)
  const date = new Date(y, m - 1 + delta, 1)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

export function daysInMonth(month: MonthKey): number {
  const [y, m] = month.split("-").map(Number)
  return new Date(y, m, 0).getDate()
}

/** Fecha concreta de un día del mes, ajustada a meses cortos (31 → 30/28). */
export function dateInMonth(month: MonthKey, day: number): ISODate {
  return `${month}-${pad(Math.min(Math.max(day, 1), daysInMonth(month)))}`
}

/** Meses completos entre dos fechas (mínimo 0). */
export function monthsBetween(from: ISODate, to: ISODate): number {
  const a = parseISODate(from)
  const b = parseISODate(to)
  return Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()))
}

export function formatMonthLabel(month: MonthKey): string {
  const [y, m] = month.split("-").map(Number)
  const label = new Date(y, m - 1, 1).toLocaleDateString(FINANCE_CONFIG.locale, {
    month: "long",
    year: "numeric",
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function formatDate(iso: ISODate, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  return parseISODate(iso).toLocaleDateString(FINANCE_CONFIG.locale, opts)
}

export function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Redondea a centavos para evitar errores de coma flotante acumulados. */
export const roundMoney = (value: number) => Math.round(value * 100) / 100
