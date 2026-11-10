import { afterEach, describe, expect, it, vi } from "vitest"

import { dueAutoRegistrations, monthPlan, recurringForMonth } from "./calculations"
import { spendingSummary, usageProfile } from "./insights"
import { createEmptyState } from "./mock-data"
import type { FinanceState, RecurringItem, Transaction } from "./types"

const at = (iso: string) => vi.setSystemTime(new Date(`${iso}T12:00:00`))
afterEach(() => vi.useRealTimers())

let seq = 0
const tx = (t: Partial<Transaction>): Transaction => ({
  id: `t${++seq}`,
  description: "x",
  amount: 1000,
  type: "expense",
  categoryId: "alimentacion",
  date: "2026-11-05",
  createdAt: seq,
  ...t,
})
const fixed = (r: Partial<RecurringItem>): RecurringItem => ({
  id: "r1",
  description: "Alquiler",
  amount: 300_000,
  type: "expense",
  categoryId: "vivienda",
  dayOfMonth: 5,
  active: true,
  ...r,
})
const state = (s: Partial<FinanceState>): FinanceState => ({ ...createEmptyState(), ...s })

describe("usageProfile", () => {
  it("solo anota gastos: tracksSpending sin plan", () => {
    at("2026-11-10")
    const p = usageProfile(state({ transactions: [tx({})] }), "2026-11")
    expect(p).toMatchObject({ tracksSpending: true, hasIncome: false, plans: false })
  })

  it("solo planifica: ingreso fijo, sin gastos anotados a mano", () => {
    at("2026-11-10")
    const p = usageProfile(
      state({ recurring: [fixed({ id: "s", type: "income", categoryId: "sueldo", amount: 900_000, dayOfMonth: 1 })] }),
      "2026-11"
    )
    expect(p).toMatchObject({ tracksSpending: false, hasIncome: true, plans: true, hasRecurring: true })
  })

  it("los fijos registrados no cuentan como 'anotar gastos'", () => {
    at("2026-11-10")
    const p = usageProfile(state({ transactions: [tx({ recurringId: "r1" })] }), "2026-11")
    expect(p.tracksSpending).toBe(false)
  })
})

describe("spendingSummary", () => {
  it("compara contra el mes anterior HASTA EL MISMO DÍA", () => {
    const s = spendingSummary(
      state({
        transactions: [
          tx({ amount: 60_000, date: "2026-11-03" }),
          tx({ amount: 40_000, date: "2026-10-02" }),
          tx({ amount: 999_000, date: "2026-10-25" }), // después del día 10: no cuenta
        ],
      }),
      "2026-11",
      "2026-11-10"
    )
    expect(s).toMatchObject({ total: 60_000, previousToDate: 40_000, elapsedDays: 10, dailyAverage: 6_000 })
    expect(s.change).toBeCloseTo(0.5)
  })

  it("sin datos del mes anterior no inventa comparación", () => {
    const s = spendingSummary(state({ transactions: [tx({ date: "2026-11-03" })] }), "2026-11", "2026-11-10")
    expect(s.previousToDate).toBeNull()
    expect(s.change).toBeNull()
  })

  it("identifica la categoría con más gasto", () => {
    const s = spendingSummary(
      state({ transactions: [tx({ categoryId: "ocio", amount: 5 }), tx({ categoryId: "transporte", amount: 9 })] }),
      "2026-11",
      "2026-11-10"
    )
    expect(s.topCategoryId).toBe("transporte")
  })
})

describe("fijos automáticos", () => {
  it("registra los que ya vencieron este mes, con id determinístico", () => {
    const due = dueAutoRegistrations(
      state({ recurring: [fixed({ autoRegister: true }), fixed({ id: "r2", dayOfMonth: 20, autoRegister: true })] }),
      "2026-11-10"
    )
    expect(due.map((d) => d.transactionId)).toEqual(["auto-r1-2026-11"]) // r2 vence el 20
  })

  it("no registra los manuales, los pausados ni los ya pagados", () => {
    const due = dueAutoRegistrations(
      state({
        recurring: [fixed({}), fixed({ id: "r2", autoRegister: true, active: false }), fixed({ id: "r3", autoRegister: true })],
        transactions: [tx({ recurringId: "r3", date: "2026-11-05" })],
      }),
      "2026-11-10"
    )
    expect(due).toEqual([])
  })

  it("si el usuario borró el registro automático, no lo recrea ni lo proyecta", () => {
    at("2026-11-10")
    const s = state({ recurring: [fixed({ autoRegister: true, lastAutoMonth: "2026-11" })] })
    expect(dueAutoRegistrations(s, "2026-11-10")).toEqual([])
    expect(recurringForMonth(s, "2026-11")[0].status).toBe("missed")
    expect(monthPlan(s, "2026-11").expenses.pendingFixed).toBe(0)
  })

  it("un fijo automático todavía no registrado nunca aparece 'vencido'", () => {
    at("2026-11-10")
    const s = state({ recurring: [fixed({ autoRegister: true })] })
    expect(recurringForMonth(s, "2026-11")[0].status).toBe("pending")
  })
})
