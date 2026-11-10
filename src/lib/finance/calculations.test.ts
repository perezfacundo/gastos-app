import { afterEach, describe, expect, it, vi } from "vitest"

import { budgetStatus, monthPlan, spendingPace } from "./calculations"
import { createEmptyState } from "./mock-data"
import type { FinanceState, Transaction } from "./types"

/** Fija "hoy" (las funciones usan la fecha del sistema para el mes actual). */
const at = (iso: string) => vi.setSystemTime(new Date(`${iso}T12:00:00`))
afterEach(() => vi.useRealTimers())

let seq = 0
const tx = (t: Partial<Transaction>): Transaction => ({
  id: `t${++seq}`,
  description: "x",
  amount: 0,
  type: "expense",
  categoryId: "alimentacion",
  date: "2026-11-01",
  createdAt: seq,
  ...t,
})

/** Noviembre 2026 (30 días): sueldo de 900.000 ya cobrado, sin fijos ni metas. */
const november = (...extra: Transaction[]): FinanceState => ({
  ...createEmptyState(),
  transactions: [tx({ type: "income", categoryId: "sueldo", amount: 900_000 }), ...extra],
})

describe("spendingPace (mes actual)", () => {
  it("reparte el saldo libre entre los días que quedan, contando hoy", () => {
    at("2026-11-21") // quedan 10 días (21..30)
    const state = november()
    const pace = spendingPace(state, monthPlan(state, "2026-11"), "2026-11-21")
    expect(pace.daysLeft).toBe(10)
    expect(pace.perDay).toBe(90_000)
    expect(pace.status).toBe("ok")
  })

  it("el diario se calcula al INICIO del día: gastar hoy no lo cambia, baja 'lo que queda hoy'", () => {
    at("2026-11-21")
    const state = november(tx({ amount: 30_000, date: "2026-11-21" }))
    const pace = spendingPace(state, monthPlan(state, "2026-11"), "2026-11-21")
    expect(pace.perDay).toBe(90_000)
    expect(pace.spentToday).toBe(30_000)
    expect(pace.leftToday).toBe(60_000)
  })

  it("si hoy se gastó más que el diario, avisa (tight) pero no es 'pasado del plan'", () => {
    at("2026-11-21")
    const state = november(tx({ amount: 120_000, date: "2026-11-21" }))
    const pace = spendingPace(state, monthPlan(state, "2026-11"), "2026-11-21")
    expect(pace.status).toBe("tight")
    expect(pace.leftToday).toBe(-30_000)
  })

  it("los fijos pagados hoy no cuentan contra el diario (ya estaban en el plan)", () => {
    at("2026-11-21")
    const state: FinanceState = {
      ...november(tx({ amount: 50_000, date: "2026-11-21", recurringId: "r1" })),
      recurring: [{ id: "r1", description: "Luz", amount: 50_000, type: "expense", categoryId: "servicios", dayOfMonth: 21, active: true }],
    }
    const pace = spendingPace(state, monthPlan(state, "2026-11"), "2026-11-21")
    expect(pace.spentToday).toBe(0)
  })

  it("si los gastos superan el ingreso, el estado es 'over'", () => {
    at("2026-11-21")
    const state = november(tx({ amount: 1_000_000, date: "2026-11-10" }))
    const pace = spendingPace(state, monthPlan(state, "2026-11"), "2026-11-21")
    expect(pace.status).toBe("over")
    expect(pace.perDay).toBe(0)
  })
})

describe("spendingPace (otros meses)", () => {
  it("mes futuro: reparte en todos los días del mes", () => {
    at("2026-10-15")
    const state = november()
    const pace = spendingPace(state, monthPlan(state, "2026-11"), "2026-10-15")
    expect(pace.timing).toBe("future")
    expect(pace.perDay).toBe(30_000) // 900.000 / 30
  })

  it("mes pasado: solo informa cómo cerró", () => {
    at("2026-12-05")
    const state = november(tx({ amount: 100_000, date: "2026-11-10" }))
    const pace = spendingPace(state, monthPlan(state, "2026-11"), "2026-12-05")
    expect(pace).toMatchObject({ timing: "past", available: 800_000, status: "ok" })
  })
})

describe("budgetStatus", () => {
  it("una categoría que es 100% fijos y no se pasó NO está en alerta", () => {
    expect(budgetStatus(350_000, 350_000, 350_000)).toBe("ok")
  })

  it("la alerta mira el margen para gastos variables, no el total", () => {
    // Límite 200k con 100k de fijos: quedan 100k variables; gastados 95k → 95% → alerta.
    expect(budgetStatus(195_000, 200_000, 100_000)).toBe("warning")
    expect(budgetStatus(150_000, 200_000, 100_000)).toBe("ok")
  })

  it("pasarse del límite siempre es 'over', haya o no fijos", () => {
    expect(budgetStatus(360_000, 350_000, 350_000)).toBe("over")
    expect(budgetStatus(201_000, 200_000, 0)).toBe("over")
  })

  it("sin límite no hay alerta", () => {
    expect(budgetStatus(999, 0)).toBe("unbudgeted")
  })
})
