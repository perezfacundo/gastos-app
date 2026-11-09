"use client"

import { SlidersHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { CategoryBudget } from "@/lib/finance/calculations"
import { formatMoney } from "@/lib/finance/format"
import type { BudgetStatus } from "@/lib/finance/types"
import { cn } from "@/lib/utils"

import { BudgetBar, STATUS_META, StatusBadge } from "../shared/budget-status"
import { IconChip } from "../shared/category-icon"

const SEVERITY: Record<BudgetStatus, number> = { over: 0, warning: 1, ok: 2, unbudgeted: 3 }

/** Presupuestos por categoría ordenados por urgencia (excedidos primero). */
export function BudgetOverview({ rows, onEditLimits }: { rows: CategoryBudget[]; onEditLimits: () => void }) {
  const visible = rows
    .filter((r) => r.limit > 0 || r.projected > 0)
    .sort((a, b) => SEVERITY[a.status] - SEVERITY[b.status] || b.ratio - a.ratio)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Presupuesto por categoría</CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2 w-4 rounded-full bg-muted-foreground/60" /> Gasto real
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="bar-pending h-2 w-4 rounded-full text-muted-foreground/70" /> Fijos por pagar
          </span>
        </CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" onClick={onEditLimits}>
            <SlidersHorizontal data-icon="inline-start" />
            Editar límites
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-x-8 gap-y-5 md:grid-cols-2">
          {visible.map((row) => (
            <BudgetRow key={row.category.id} row={row} />
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

export function BudgetRow({ row }: { row: CategoryBudget }) {
  const { category, limit, spent, pendingFixed, remaining, status } = row
  const meta = STATUS_META[status]

  return (
    <li className="space-y-2">
      <div className="flex items-center gap-3">
        <IconChip icon={category.icon} color={category.color} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{category.name}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {formatMoney(spent)}
            {pendingFixed > 0 && <> + {formatMoney(pendingFixed)} fijos</>}
            {limit > 0 && <> de {formatMoney(limit)}</>}
          </p>
        </div>
        <StatusBadge status={status} />
      </div>
      <BudgetBar spent={spent} pending={pendingFixed} limit={limit} status={status} label={`Presupuesto de ${category.name}`} />
      {limit > 0 && (
        <p className={cn("text-right text-xs tabular-nums", status === "over" ? meta.ink : "text-muted-foreground")}>
          {remaining >= 0 ? `Quedan ${formatMoney(remaining)}` : `Excedido por ${formatMoney(-remaining)}`}
        </p>
      )}
    </li>
  )
}
