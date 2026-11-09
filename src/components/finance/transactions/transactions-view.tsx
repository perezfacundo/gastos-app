"use client"

import { Plus, Receipt, Repeat, Search, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useCategoryMap, useMonthPlan } from "@/hooks/use-finance"
import { financeActions } from "@/lib/finance/actions"
import { budgetStatus, byDateDesc, transactionsInMonth } from "@/lib/finance/calculations"
import { formatDate, formatMoney, formatMoneyPrecise, formatPercent } from "@/lib/finance/format"
import type { FinanceState, MonthKey, Transaction, TransactionType } from "@/lib/finance/types"
import { cn } from "@/lib/utils"

import { STATUS_META } from "../shared/budget-status"
import { IconChip } from "../shared/category-icon"
import { CategorySelect } from "../shared/form-fields"
import { EmptyState } from "../shared/misc"

interface TransactionsViewProps {
  state: FinanceState
  month: MonthKey
  onAdd: () => void
}

type TypeFilter = "all" | TransactionType

/** Movimientos reales del mes, contrastados contra lo planificado. */
export function TransactionsView({ state, month, onAdd }: TransactionsViewProps) {
  const plan = useMonthPlan(state, month)
  const categoryMap = useCategoryMap(state)
  const [query, setQuery] = useState("")
  const [type, setType] = useState<TypeFilter>("all")
  const [categoryId, setCategoryId] = useState("all")

  const monthTx = useMemo(() => transactionsInMonth(state, month).sort(byDateDesc), [state, month])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return monthTx.filter(
      (t) =>
        (type === "all" || t.type === type) &&
        (categoryId === "all" || t.categoryId === categoryId) &&
        (!q || t.description.toLowerCase().includes(q))
    )
  }, [monthTx, query, type, categoryId])

  // Agrupa por día para una lectura tipo "extracto".
  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    for (const t of filtered) map.set(t.date, [...(map.get(t.date) ?? []), t])
    return [...map.entries()]
  }, [filtered])

  const filtersActive = query !== "" || type !== "all" || categoryId !== "all"

  function remove(tx: Transaction) {
    financeActions.removeTransaction(tx.id)
    toast(`Se eliminó “${tx.description}”`, {
      action: { label: "Deshacer", onClick: () => financeActions.restoreTransaction(tx) },
    })
  }

  return (
    <div className="space-y-6">
      {/* Real vs. planificado */}
      <section className="grid gap-4 sm:grid-cols-2" aria-label="Real contra planificado">
        <PlanVsActual
          title="Gastos reales vs. presupuesto"
          actual={plan.expenses.actual}
          planned={plan.budgets.totalLimit}
          plannedLabel="presupuestado"
          higherIsBad
        />
        <PlanVsActual
          title="Ingresos reales vs. previstos"
          actual={plan.income.actual}
          planned={plan.income.expected}
          plannedLabel="previsto"
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Movimientos</CardTitle>
          <CardDescription>
            {filtered.length} de {monthTx.length} en el mes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative sm:max-w-xs sm:flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                type="search"
                placeholder="Buscar…"
                aria-label="Buscar movimientos"
                className="pl-8"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Tabs value={type} onValueChange={(v) => setType(v as TypeFilter)}>
              <TabsList aria-label="Filtrar por tipo">
                <TabsTrigger value="all">Todos</TabsTrigger>
                <TabsTrigger value="expense">Gastos</TabsTrigger>
                <TabsTrigger value="income">Ingresos</TabsTrigger>
              </TabsList>
            </Tabs>
            <CategorySelect
              categories={state.categories}
              kind={type === "all" ? undefined : type}
              value={categoryId}
              onValueChange={setCategoryId}
              allLabel="Todas las categorías"
              className="sm:w-52"
              aria-invalid={undefined}
            />
            {filtersActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQuery("")
                  setType("all")
                  setCategoryId("all")
                }}
              >
                Limpiar
              </Button>
            )}
          </div>

          {groups.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title={filtersActive ? "Nada coincide con los filtros" : "Sin movimientos este mes"}
              description={filtersActive ? "Probá con otros filtros." : "Registrá lo que gastás para compararlo con tu plan."}
              action={
                !filtersActive && (
                  <Button size="sm" onClick={onAdd}>
                    <Plus data-icon="inline-start" />
                    Nuevo movimiento
                  </Button>
                )
              }
            />
          ) : (
            <div className="space-y-5">
              {groups.map(([date, items]) => {
                const net = items.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0)
                return (
                  <section key={date} aria-label={formatDate(date, { weekday: "long", day: "numeric", month: "long" })}>
                    <header className="mb-1 flex items-center justify-between px-1 text-xs text-muted-foreground">
                      <span className="font-medium capitalize">
                        {formatDate(date, { weekday: "long", day: "numeric", month: "short" })}
                      </span>
                      <span className="tabular-nums">{net >= 0 ? "+" : "−"} {formatMoney(Math.abs(net))}</span>
                    </header>
                    <ul className="divide-y rounded-lg border">
                      {items.map((t) => {
                        const category = categoryMap.get(t.categoryId)
                        const income = t.type === "income"
                        return (
                          <li key={t.id} className="group flex items-center gap-3 px-3 py-2.5">
                            {category && <IconChip icon={category.icon} color={category.color} size="sm" />}
                            <div className="min-w-0 flex-1">
                              <p className="flex items-center gap-2 truncate text-sm font-medium">
                                {t.description}
                                {t.recurringId && (
                                  <Badge variant="secondary" className="gap-1">
                                    <Repeat aria-hidden="true" /> Fijo
                                  </Badge>
                                )}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">{category?.name ?? "Sin categoría"}</p>
                            </div>
                            <p className={cn("text-sm font-semibold tabular-nums whitespace-nowrap", income && "text-good-ink")}>
                              {income ? "+" : "−"} {formatMoneyPrecise(t.amount)}
                            </p>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  className="text-muted-foreground hover:text-destructive"
                                  aria-label={`Eliminar ${t.description}`}
                                  onClick={() => remove(t)}
                                >
                                  <Trash2 />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Eliminar</TooltipContent>
                            </Tooltip>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function PlanVsActual({
  title,
  actual,
  planned,
  plannedLabel,
  higherIsBad = false,
}: {
  title: string
  actual: number
  planned: number
  plannedLabel: string
  higherIsBad?: boolean
}) {
  const ratio = planned > 0 ? actual / planned : 0
  // Para gastos: superar el plan es malo (estado de presupuesto). Para ingresos: neutro.
  const status = higherIsBad ? budgetStatus(actual, planned) : "unbudgeted"
  const fill = higherIsBad ? STATUS_META[status].fill : "bg-good"

  return (
    <Card className="gap-3 py-4">
      <CardContent className="space-y-2 px-4">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-sm tabular-nums">
          <span className="text-xl font-semibold">{formatMoney(actual)}</span>{" "}
          <span className="text-muted-foreground">
            de {formatMoney(planned)} {plannedLabel} · {formatPercent(ratio)}
          </span>
        </p>
        <Progress value={ratio * 100} className="h-2" indicatorClassName={fill} aria-label={title} />
      </CardContent>
    </Card>
  )
}
