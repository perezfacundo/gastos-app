/**
 * Datos de ejemplo coherentes, generados RELATIVOS a la fecha actual para que la
 * interfaz siempre luzca "viva": 3 meses de historial + el mes en curso, con
 * algunos presupuestos en alerta y una meta atrasada para mostrar los estados.
 */
import { currentMonthKey, dateInMonth, generateId, shiftMonth } from "./format"
import type { Category, FinanceState, GoalMovement, RecurringItem, SavingsGoal, Transaction } from "./types"

const CATEGORIES: Category[] = [
  { id: "vivienda", name: "Vivienda", icon: "house", color: "aqua", kind: "expense", monthlyLimit: 360_000 },
  { id: "alimentacion", name: "Alimentación", icon: "cart", color: "blue", kind: "expense", monthlyLimit: 200_000 },
  { id: "transporte", name: "Transporte", icon: "bus", color: "orange", kind: "expense", monthlyLimit: 50_000 },
  { id: "servicios", name: "Servicios", icon: "zap", color: "magenta", kind: "expense", monthlyLimit: 75_000 },
  { id: "salud", name: "Salud", icon: "heart", color: "green", kind: "expense", monthlyLimit: 50_000 },
  { id: "ocio", name: "Ocio", icon: "clapperboard", color: "yellow", kind: "expense", monthlyLimit: 50_000 },
  { id: "otros", name: "Otros", icon: "package", color: "red", kind: "expense", monthlyLimit: 15_000, system: true },
  { id: "sueldo", name: "Sueldo", icon: "briefcase", color: "violet", kind: "income", monthlyLimit: 0 },
  { id: "freelance", name: "Freelance", icon: "laptop", color: "blue", kind: "income", monthlyLimit: 0 },
  { id: "otros-ingresos", name: "Otros ingresos", icon: "coins", color: "green", kind: "income", monthlyLimit: 0, system: true },
]

const RECURRING: RecurringItem[] = [
  { id: "r-sueldo", description: "Sueldo", amount: 980_000, type: "income", categoryId: "sueldo", dayOfMonth: 1, active: true, autoRegister: true, lastAutoMonth: null },
  { id: "r-gimnasio", description: "Gimnasio", amount: 25_000, type: "expense", categoryId: "salud", dayOfMonth: 3, active: true, autoRegister: true, lastAutoMonth: null },
  { id: "r-alquiler", description: "Alquiler", amount: 320_000, type: "expense", categoryId: "vivienda", dayOfMonth: 5, active: true, autoRegister: true, lastAutoMonth: null },
  { id: "r-internet", description: "Internet y TV", amount: 28_900, type: "expense", categoryId: "servicios", dayOfMonth: 10, active: true, autoRegister: true, lastAutoMonth: null },
  { id: "r-streaming", description: "Streaming", amount: 9_800, type: "expense", categoryId: "ocio", dayOfMonth: 12, active: true, autoRegister: true, lastAutoMonth: null },
  { id: "r-luz-gas", description: "Luz y gas", amount: 35_000, type: "expense", categoryId: "servicios", dayOfMonth: 18, active: true },
]

/** [descripción, monto, categoría, día] — gastos variables del mes en curso. */
const CURRENT_MONTH_EXPENSES: [string, number, string, number][] = [
  ["Carga SUBE", 15_000, "transporte", 1],
  ["Supermercado", 68_500, "alimentacion", 2],
  ["Almacén", 15_600, "alimentacion", 3],
  ["Verdulería", 12_400, "alimentacion", 4],
  ["Cine y cena", 38_000, "ocio", 4],
  ["Nafta", 25_000, "transporte", 5],
  ["Regalo de cumpleaños", 9_000, "otros", 5],
  ["Supermercado", 54_800, "alimentacion", 6],
  ["Farmacia", 8_700, "salud", 6],
  ["Salida con amigos", 14_500, "ocio", 6],
  ["Carnicería", 21_300, "alimentacion", 7],
  ["Delivery", 9_800, "alimentacion", 7],
]

/** Gastos variables "típicos" de meses anteriores (se escalan levemente mes a mes). */
const PAST_MONTH_EXPENSES: [string, number, string, number][] = [
  ["Supermercado", 72_300, "alimentacion", 3],
  ["Carga SUBE", 15_000, "transporte", 4],
  ["Verdulería", 14_100, "alimentacion", 8],
  ["Nafta", 28_000, "transporte", 11],
  ["Salida", 22_000, "ocio", 13],
  ["Supermercado", 63_900, "alimentacion", 16],
  ["Consulta médica", 12_000, "salud", 19],
  ["Carnicería", 24_500, "alimentacion", 21],
  ["Ferretería", 8_400, "otros", 24],
  ["Supermercado", 41_200, "alimentacion", 27],
]

export function createMockState(): FinanceState {
  const thisMonth = currentMonthKey()
  const todayDay = new Date().getDate()
  const now = Date.now()
  let order = 0

  const tx = (
    description: string,
    amount: number,
    categoryId: string,
    date: string,
    type: Transaction["type"] = "expense",
    recurringId?: string
  ): Transaction => ({
    id: generateId(),
    description,
    amount,
    type,
    categoryId,
    date,
    recurringId,
    createdAt: now - order++,
  })

  const transactions: Transaction[] = []

  // Meses anteriores: todos los fijos registrados + gastos variables.
  for (const offset of [3, 2, 1]) {
    const month = shiftMonth(thisMonth, -offset)
    const factor = 1 - offset * 0.03 // leve inflación mes a mes
    for (const r of RECURRING) {
      transactions.push(tx(r.description, r.amount, r.categoryId, dateInMonth(month, r.dayOfMonth), r.type, r.id))
    }
    for (const [description, amount, categoryId, day] of PAST_MONTH_EXPENSES) {
      transactions.push(tx(description, Math.round(amount * factor), categoryId, dateInMonth(month, day)))
    }
  }
  transactions.push(tx("Proyecto freelance", 180_000, "freelance", dateInMonth(shiftMonth(thisMonth, -1), 20), "income"))

  // Mes en curso: solo lo que ya pasó (los fijos futuros quedan "por pagar").
  for (const r of RECURRING) {
    if (r.dayOfMonth <= todayDay) {
      transactions.push(tx(r.description, r.amount, r.categoryId, dateInMonth(thisMonth, r.dayOfMonth), r.type, r.id))
    }
  }
  for (const [description, amount, categoryId, day] of CURRENT_MONTH_EXPENSES) {
    transactions.push(tx(description, amount, categoryId, dateInMonth(thisMonth, Math.min(day, todayDay))))
  }

  const goals: SavingsGoal[] = [
    {
      id: "g-emergencia",
      name: "Fondo de emergencia",
      icon: "shield",
      color: "aqua",
      targetAmount: 2_000_000,
      monthlyContribution: 60_000,
      deadline: dateInMonth(shiftMonth(thisMonth, 20), 28),
      createdAt: now - 3,
    },
    {
      id: "g-viaje",
      name: "Viaje a Bariloche",
      icon: "plane",
      color: "orange",
      targetAmount: 900_000,
      monthlyContribution: 50_000,
      deadline: dateInMonth(shiftMonth(thisMonth, 5), 15),
      createdAt: now - 2,
    },
    {
      id: "g-notebook",
      name: "Notebook nueva",
      icon: "laptop",
      color: "violet",
      targetAmount: 1_200_000,
      monthlyContribution: 40_000,
      deadline: dateInMonth(shiftMonth(thisMonth, 23), 1),
      createdAt: now - 1,
    },
  ]

  const movement = (goalId: string, amount: number, monthOffset: number, day = 2): GoalMovement => ({
    id: generateId(),
    goalId,
    amount,
    date: dateInMonth(shiftMonth(thisMonth, monthOffset), monthOffset === 0 ? Math.min(day, todayDay) : day),
  })

  const goalMovements: GoalMovement[] = [
    movement("g-emergencia", 670_000, -3),
    movement("g-emergencia", 60_000, -2),
    movement("g-emergencia", 60_000, -1),
    movement("g-emergencia", 60_000, 0),
    movement("g-viaje", 420_000, -3),
    movement("g-viaje", 50_000, -2),
    movement("g-viaje", 50_000, -1),
    movement("g-notebook", 220_000, -3),
    movement("g-notebook", 40_000, -2),
    movement("g-notebook", 40_000, -1),
  ]

  return {
    version: 1,
    categories: CATEGORIES.map((c) => ({ ...c })),
    transactions,
    recurring: RECURRING.map((r) => ({ ...r })),
    goals,
    goalMovements,
  }
}

/** Estado vacío (para "Empezar de cero"): conserva las categorías base sin límites. */
export function createEmptyState(): FinanceState {
  return {
    version: 1,
    categories: CATEGORIES.map((c) => ({ ...c, monthlyLimit: 0 })),
    transactions: [],
    recurring: [],
    goals: [],
    goalMovements: [],
  }
}
