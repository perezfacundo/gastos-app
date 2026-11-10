"use client"

import { BellRing, Receipt, SlidersHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { CategoryBudget } from "@/lib/finance/calculations"
import { colorVar } from "@/lib/finance/config"
import { formatMoney, formatPercent } from "@/lib/finance/format"
import type { BudgetStatus } from "@/lib/finance/types"
import { cn } from "@/lib/utils"

import { BudgetBar, STATUS_META, StatusBadge } from "../shared/budget-status"
import { IconChip } from "../shared/category-icon"
import { EmptyState } from "../shared/misc"

const SEVERITY: Record<BudgetStatus, number> = { over: 0, warning: 1, ok: 2, unbudgeted: 3 }

interface CategoryBreakdownProps {
  rows: CategoryBudget[]
  onEditLimits: () => void
  onAddTransaction: () => void
}

/**
 * "¿En qué gastás?" — funciona con o sin plan:
 *  - Categoría con límite → barra contra el límite y estado (plan).
 *  - Categoría sin límite → cuánto pesa en el total del mes (solo registro).
 * Sin ningún límite, invita a ponerlos (complemento, no obligación).
 */
export function CategoryBreakdown({ rows, onEditLimits, onAddTransaction }: CategoryBreakdownProps) {
  const visible = rows.filter((r) => r.limit > 0 || r.projected > 0)
  const limited = visible
    .filter((r) => r.limit > 0)
    .sort((a, b) => SEVERITY[a.status] - SEVERITY[b.status] || b.ratio - a.ratio)
  const unlimited = visible.filter((r) => r.limit === 0).sort((a, b) => b.projected - a.projected)
  const total = visible.reduce((s, r) => s + r.projected, 0)
  const biggest = Math.max(...unlimited.map((r) => r.projected), 1)
  const hasLimits = limited.length > 0
  const hasPending = visible.some((r) => r.pendingFixed > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{hasLimits ? "Presupuesto por categoría" : "En qué gastás"}</CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {hasLimits || hasPending ? (
            <>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="h-2 w-4 rounded-full bg-muted-foreground/60" /> Gasto real
              </span>
              {hasPending && (
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className="bar-pending h-2 w-4 rounded-full text-muted-foreground/70" /> Fijos por pagar
                </span>
              )}
            </>
          ) : (
            total > 0 && <span>Total del mes: {formatMoney(total)}</span>
          )}
        </CardDescription>
        {hasLimits && (
          <CardAction>
            <Button variant="outline" size="sm" onClick={onEditLimits}>
              <SlidersHorizontal data-icon="inline-start" />
              Editar límites
            </Button>
          </CardAction>
        )}
      </CardHeader>

      <CardContent className="space-y-5">
        {visible.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Todavía no hay gastos este mes"
            description="Anotá lo que gastás y vas a ver acá en qué se va tu plata."
            action={
              <Button size="sm" onClick={onAddTransaction}>
                Anotar un gasto
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-x-8 gap-y-5 md:grid-cols-2">
            {limited.map((row) => (
              <BudgetRow key={row.category.id} row={row} />
            ))}
            {unlimited.map((row) => (
              <ShareRow key={row.category.id} row={row} total={total} biggest={biggest} />
            ))}
          </ul>
        )}

        {/* Complemento: quien solo registra puede sumar límites cuando quiera. */}
        {!hasLimits && visible.length > 0 && (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-4 sm:flex-row sm:items-center">
            <BellRing className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="flex-1 text-sm text-muted-foreground">
              <strong className="text-foreground">¿Querés que te avisemos antes de pasarte?</strong> Poné un límite por
              categoría; te sugerimos uno según lo que venís gastando.
            </p>
            <Button size="sm" variant="outline" onClick={onEditLimits}>
              Poner límites
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** Fila con límite: gasto real + fijos por pagar contra el tope. */
function BudgetRow({ row }: { row: CategoryBudget }) {
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
            {pendingFixed > 0 && <> + {formatMoney(pendingFixed)} fijos</>} de {formatMoney(limit)}
          </p>
        </div>
        <StatusBadge status={status} />
      </div>
      <BudgetBar spent={spent} pending={pendingFixed} limit={limit} status={status} label={`Presupuesto de ${category.name}`} />
      <p className={cn("text-right text-xs tabular-nums", status === "over" ? meta.ink : "text-muted-foreground")}>
        {remaining >= 0 ? `Quedan ${formatMoney(remaining)}` : `Excedido por ${formatMoney(-remaining)}`}
      </p>
    </li>
  )
}

/** Fila sin límite: cuánto pesa la categoría en el total (barra relativa a la mayor). */
function ShareRow({ row, total, biggest }: { row: CategoryBudget; total: number; biggest: number }) {
  const { category, spent, pendingFixed, projected } = row
  return (
    <li className="space-y-2">
      <div className="flex items-center gap-3">
        <IconChip icon={category.icon} color={category.color} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{category.name}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {formatMoney(spent)}
            {pendingFixed > 0 && <> + {formatMoney(pendingFixed)} fijos</>}
          </p>
        </div>
        <span className="text-sm font-medium tabular-nums">{formatPercent(total ? projected / total : 0)}</span>
      </div>
      <div
        role="img"
        aria-label={`${category.name}: ${formatPercent(total ? projected / total : 0)} del total`}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${(projected / biggest) * 100}%`, backgroundColor: colorVar(category.color) }}
        />
      </div>
    </li>
  )
}
