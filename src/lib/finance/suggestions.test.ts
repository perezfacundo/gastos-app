import { describe, expect, it } from "vitest"

import { createEmptyState } from "./mock-data"
import { descriptionSuggestions, normalizeText, rankCategories } from "./suggestions"
import type { FinanceState, Transaction } from "./types"

let seq = 0
const tx = (description: string, categoryId: string, date: string, amount = 1000): Transaction => ({
  id: `t${++seq}`,
  description,
  amount,
  type: "expense",
  categoryId,
  date,
  createdAt: seq,
})

const withTx = (...transactions: Transaction[]): FinanceState => ({ ...createEmptyState(), transactions })

describe("normalizeText", () => {
  it("ignora mayúsculas, tildes y espacios de más", () => {
    expect(normalizeText("  SÚPER   Mercado ")).toBe("super mercado")
  })
})

describe("rankCategories", () => {
  it("pone primero las categorías más usadas en los últimos 90 días", () => {
    const state = withTx(
      tx("a", "ocio", "2026-11-01"),
      tx("b", "ocio", "2026-11-02"),
      tx("c", "transporte", "2026-11-03"),
      tx("viejo", "salud", "2026-01-01"), // fuera de la ventana: no cuenta
      tx("viejo", "salud", "2026-01-02")
    )
    const ids = rankCategories(state, "expense", { today: "2026-11-09" }).map((c) => c.id)
    expect(ids.slice(0, 2)).toEqual(["ocio", "transporte"])
    // Sin uso reciente: primero las de gasto diario (Alimentación), no Vivienda.
    expect(ids[2]).toBe("alimentacion")
  })

  it("no cuenta los fijos registrados (no son cargas a mano)", () => {
    const alquiler = { ...tx("Alquiler", "vivienda", "2026-11-05"), recurringId: "r1" }
    const state = withTx(alquiler, { ...alquiler, id: "x2", date: "2026-10-05" })
    expect(rankCategories(state, "expense", { today: "2026-11-09" })[0].id).toBe("alimentacion")
  })

  it("solo devuelve categorías del tipo pedido", () => {
    const ids = rankCategories(createEmptyState(), "income").map((c) => c.kind)
    expect(new Set(ids)).toEqual(new Set(["income"]))
  })
})

describe("descriptionSuggestions", () => {
  const state = withTx(
    tx("Supermercado", "alimentacion", "2026-11-01", 50_000),
    tx("supermercado", "alimentacion", "2026-11-05", 62_000), // la más reciente define monto
    tx("Super chino", "alimentacion", "2026-11-03", 8_000),
    tx("Nafta", "transporte", "2026-11-02", 25_000)
  )

  it("agrupa sin importar mayúsculas y propone el monto más reciente", () => {
    const [first] = descriptionSuggestions(state, "expense", "super")
    expect(first).toMatchObject({ description: "supermercado", amount: 62_000, count: 2, categoryId: "alimentacion" })
  })

  it("prioriza las que empiezan con el texto escrito", () => {
    const result = descriptionSuggestions(state, "expense", "mercado")
    expect(result.map((s) => s.description)).toEqual(["supermercado"])
    const byPrefix = descriptionSuggestions(state, "expense", "su")
    expect(byPrefix.map((s) => normalizeText(s.description))).toEqual(["supermercado", "super chino"])
  })

  it("no sugiere nada con texto vacío ni repite lo que ya está escrito", () => {
    expect(descriptionSuggestions(state, "expense", "  ")).toEqual([])
    expect(descriptionSuggestions(state, "expense", "Nafta")).toEqual([])
  })
})
