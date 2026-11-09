"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { MonthPlan } from "@/lib/finance/calculations"
import { formatMoney, formatPercent } from "@/lib/finance/format"
import { cn } from "@/lib/utils"

interface Segment {
  key: string
  label: string
  description: string
  value: number
  color: string
}

/**
 * "¿A dónde va mi ingreso este mes?" — barra apilada (presupuesto base cero):
 * gastado + fijos por pagar + presupuesto disponible + ahorro + sin asignar = ingreso previsto.
 */
export function CashFlowCard({ plan }: { plan: MonthPlan }) {
  const segments: Segment[] = [
    {
      key: "spent",
      label: "Gastado",
      description: "Gastos reales registrados este mes",
      value: plan.expenses.actual,
      color: "var(--cat-blue)",
    },
    {
      key: "fixed",
      label: "Fijos por pagar",
      description: "Gastos fijos que todavía no registraste",
      value: plan.expenses.pendingFixed,
      color: "var(--cat-orange)",
    },
    {
      key: "budget",
      label: "Presupuesto disponible",
      description: "Lo que aún queda dentro de los límites de cada categoría",
      value: plan.budgets.remainingBudget,
      color: "var(--cat-aqua)",
    },
    {
      key: "savings",
      label: "Ahorro planificado",
      description: "Aportes mensuales reservados para tus metas",
      value: plan.savings.reserved,
      color: "var(--cat-violet)",
    },
  ]

  const income = plan.income.expected
  const allocated = segments.reduce((s, x) => s + x.value, 0)
  const scale = Math.max(income, allocated, 1)
  const overflow = plan.unassigned < 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Flujo previsto del mes</CardTitle>
        <CardDescription>
          Cómo se reparte tu ingreso previsto de <strong className="text-foreground">{formatMoney(income)}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Barra apilada: 2px de separación entre segmentos, tooltip por segmento */}
        <div className="relative">
          <div className="flex h-4 w-full gap-0.5 overflow-hidden rounded-full bg-muted" role="img" aria-label="Distribución del ingreso previsto">
            {segments
              .filter((s) => s.value > 0)
              .map((s) => (
                <Tooltip key={s.key}>
                  <TooltipTrigger asChild>
                    <div
                      className="h-full transition-[width] duration-500 first:rounded-l-full last:rounded-r-full hover:opacity-85"
                      style={{ width: `${(s.value / scale) * 100}%`, backgroundColor: s.color }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    {s.label}: {formatMoney(s.value)} ({formatPercent(income ? s.value / income : 0)})
                  </TooltipContent>
                </Tooltip>
              ))}
          </div>
          {overflow && income > 0 && (
            <div
              aria-hidden="true"
              className="absolute -inset-y-1 w-0.5 rounded bg-foreground"
              style={{ left: `calc(${(income / scale) * 100}% - 1px)` }}
              title="Ingreso previsto"
            />
          )}
        </div>

        {/* Leyenda = tabla de datos (la identidad nunca depende solo del color) */}
        <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
          {segments.map((s) => (
            <div key={s.key} className="flex items-center gap-2.5 text-sm">
              <span aria-hidden="true" className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
              <dt className="flex-1 truncate text-muted-foreground" title={s.description}>
                {s.label}
              </dt>
              <dd className="font-medium tabular-nums">{formatMoney(s.value)}</dd>
            </div>
          ))}
          <div className="flex items-center gap-2.5 text-sm">
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-sm border border-foreground/25 bg-muted" />
            <dt className={cn("flex-1 truncate", overflow ? "text-bad-ink" : "text-muted-foreground")}>
              {overflow ? "Excede tus ingresos" : "Sin asignar"}
            </dt>
            <dd className={cn("font-medium tabular-nums", overflow && "text-bad-ink")}>
              {formatMoney(Math.abs(plan.unassigned))}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}
