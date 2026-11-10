import { describe, expect, it, vi } from "vitest"

import { dueAutoRegistrations, monthPlan } from "./calculations"
import { currentMonthKey, dateInMonth } from "./format"
import { createEmptyState } from "./mock-data"
import { buildOnboardingState, suggestLimits, suggestSavings, type OnboardingInput } from "./onboarding"

const base = createEmptyState()
const month = currentMonthKey()

const input = (overrides: Partial<OnboardingInput> = {}): OnboardingInput => ({
  income: 1_000_000,
  incomeDay: 1,
  fixed: [
    { description: "Alquiler", categoryId: "vivienda", amount: 300_000, day: 5 },
    { description: "Internet", categoryId: "servicios", amount: 30_000, day: 25 },
  ],
  savings: 100_000,
  limits: {},
  ...overrides,
})

describe("suggestSavings", () => {
  it("sugiere el 10% del ingreso, redondeado a miles", () => {
    expect(suggestSavings(987_654)).toBe(99_000)
    expect(suggestSavings(0)).toBe(0)
  })
})

describe("suggestLimits", () => {
  it("cada categoría recibe sus fijos + su parte del dinero variable", () => {
    const { fixed, income, savings } = input()
    const limits = suggestLimits(base.categories, income, fixed, savings)
    // variable = 1.000.000 − 330.000 − 100.000 = 570.000
    expect(limits.vivienda).toBe(300_000) // solo fijos
    expect(limits.servicios).toBe(30_000)
    expect(limits.alimentacion).toBe(Math.floor((570_000 * 0.45) / 1000) * 1000)
  })

  it("si los fijos superan el ingreso, no inventa dinero variable", () => {
    const limits = suggestLimits(base.categories, 100_000, input().fixed, 0)
    expect(limits.alimentacion).toBe(0)
    expect(limits.vivienda).toBe(300_000)
  })

  it.each([
    [1_000_000, 300_000, 30_000, 100_000],
    [1_200_000, 350_000, 40_000, 81_000], // caso real que antes se pasaba por $3.000
    [987_654, 333_333, 44_444, 61_000],
  ])("con ingreso %i el plan sugerido NUNCA se pasa del ingreso y casi no deja resto", (income, alquiler, luz, savings) => {
    const fixed = [
      { description: "Alquiler", categoryId: "vivienda", amount: alquiler, day: 5 },
      { description: "Luz", categoryId: "servicios", amount: luz, day: 15 },
    ]
    const limits = suggestLimits(base.categories, income, fixed, savings)
    const assigned = Object.values(limits).reduce((s, n) => s + n, 0) + savings
    expect(assigned).toBeLessThanOrEqual(income)
    expect(income - assigned).toBeLessThan(10_000) // solo redondeos a miles
    expect(limits.vivienda).toBeGreaterThanOrEqual(alquiler) // los fijos siempre entran
  })
})

describe("buildOnboardingState", () => {
  it("crea sueldo, fijos, límites y meta de ahorro", () => {
    const limits = suggestLimits(base.categories, 1_000_000, input().fixed, 100_000)
    const state = buildOnboardingState(base, input({ limits }))

    expect(state.recurring.map((r) => r.description)).toEqual(["Sueldo", "Alquiler", "Internet"])
    expect(state.categories.find((c) => c.id === "alimentacion")?.monthlyLimit).toBe(limits.alimentacion)
    expect(state.goals).toHaveLength(1)
    expect(state.goals[0].monthlyContribution).toBe(100_000)
  })

  it("los fijos e ingreso son automáticos: los ya vencidos se registran solos", () => {
    const state = buildOnboardingState(base, input())
    expect(state.recurring.every((r) => r.autoRegister)).toBe(true)
    expect(state.transactions).toHaveLength(0) // el plan nace sin movimientos

    // Día 10: sueldo (1) y alquiler (5) ya vencieron; internet (25) todavía no.
    const due = dueAutoRegistrations(state, dateInMonth(month, 10))
    expect(due.map((d) => d.item.description).sort()).toEqual(["Alquiler", "Sueldo"])

    // Y el plan recién creado no arranca con alertas de "vencido".
    vi.setSystemTime(new Date(`${dateInMonth(month, 10)}T12:00:00`))
    expect(monthPlan(state, month).recurring.filter((o) => o.status === "overdue")).toHaveLength(0)
    vi.useRealTimers()
  })

  it("sin ahorro no crea meta; sin ingreso no crea sueldo", () => {
    const state = buildOnboardingState(base, input({ savings: 0, income: 0 }))
    expect(state.goals).toHaveLength(0)
    expect(state.recurring.some((r) => r.type === "income")).toBe(false)
  })

  it("descarta fijos en 0 y manda categorías inexistentes a 'otros'", () => {
    const state = buildOnboardingState(
      base,
      input({
        fixed: [
          { description: "Nada", categoryId: "vivienda", amount: 0, day: 1 },
          { description: "Raro", categoryId: "no-existe", amount: 5000, day: 40 },
        ],
      })
    )
    const fixed = state.recurring.filter((r) => r.type === "expense")
    expect(fixed).toHaveLength(1)
    expect(fixed[0]).toMatchObject({ categoryId: "otros", dayOfMonth: 31 })
  })
})
