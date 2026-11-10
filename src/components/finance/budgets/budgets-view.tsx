"use client"

import { Ellipsis, Lock, Pencil, Plus, Sparkles, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useMonthPlan } from "@/hooks/use-finance"
import { financeActions } from "@/lib/finance/actions"
import { averageMonthlySpend, type CategoryBudget } from "@/lib/finance/calculations"
import { formatMoney } from "@/lib/finance/format"
import type { Category, FinanceState, MonthKey } from "@/lib/finance/types"

import { BudgetBar, StatusBadge } from "../shared/budget-status"
import { IconChip } from "../shared/category-icon"
import { MoneyInput, parseAmount } from "../shared/form-fields"
import { useDialogState } from "../shared/misc"
import { CategoryFormDialog } from "./category-form-dialog"

interface BudgetsViewProps {
  state: FinanceState
  month: MonthKey
}

/** Gestor de categorías y topes de gasto mensual. */
export function BudgetsView({ state, month }: BudgetsViewProps) {
  const plan = useMonthPlan(state, month)
  const dialog = useDialogState<Category>()
  const [toDelete, setToDelete] = useState<Category | null>(null)

  const averages = useMemo(
    () => new Map(state.categories.map((c) => [c.id, averageMonthlySpend(state, c.id, month)])),
    [state, month]
  )
  const incomeCategories = state.categories.filter((c) => c.kind === "income")

  function confirmDelete() {
    if (!toDelete) return
    financeActions.removeCategory(toDelete.id)
    toast.success(`Se eliminó “${toDelete.name}”`, { description: "Sus movimientos pasaron a “Otros”." })
    setToDelete(null)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Límites de gasto mensual</CardTitle>
          <CardDescription>
            Opcionales. Si anotás tus gastos, te mostramos tu promedio de los últimos 3 meses y te sugerimos un tope (✨).
            Se guarda al salir del campo.
          </CardDescription>
          <CardAction>
            <Button size="sm" onClick={() => dialog.openWith(null)}>
              <Plus data-icon="inline-start" />
              Nueva categoría
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {plan.budgets.rows.map((row) => (
              <CategoryLimitRow
                // La key incluye el límite: si cambia desde otro lado, el borrador se reinicia.
                key={`${row.category.id}:${row.limit}`}
                row={row}
                average={averages.get(row.category.id) ?? 0}
                onEdit={() => dialog.openWith(row.category)}
                onDelete={() => setToDelete(row.category)}
              />
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Categorías de ingreso</CardTitle>
          <CardDescription>No tienen límite; sirven para clasificar lo que cobrás.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {incomeCategories.map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                <IconChip icon={c.icon} color={c.color} size="sm" />
                <span className="flex-1 truncate text-sm font-medium">{c.name}</span>
                <CategoryMenu category={c} onEdit={() => dialog.openWith(c)} onDelete={() => setToDelete(c)} />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <CategoryFormDialog
        open={dialog.open}
        onOpenChange={dialog.setOpen}
        formKey={dialog.key}
        state={state}
        category={dialog.item}
      />

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar “{toDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Los movimientos y fijos de esta categoría se moverán a “Otros”. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * Fila editable de límite
 * ------------------------------------------------------------------------- */

function CategoryLimitRow({
  row,
  average,
  onEdit,
  onDelete,
}: {
  row: CategoryBudget
  average: number
  onEdit: () => void
  onDelete: () => void
}) {
  const { category, limit, spent, pendingFixed, projected, status } = row
  const [draft, setDraft] = useState(limit ? String(limit) : "")
  const suggested = Math.ceil(average / 1000) * 1000

  function commit(raw = draft) {
    const next = raw.trim() === "" ? 0 : parseAmount(raw)
    if (!Number.isFinite(next) || next < 0) {
      setDraft(limit ? String(limit) : "")
      toast.error("Monto inválido", { description: "El límite debe ser un número positivo." })
      return
    }
    if (next === limit) return
    financeActions.setCategoryLimit(category.id, next)
    toast.success(`Límite de ${category.name} actualizado`, {
      description: next ? `${formatMoney(next)} por mes` : "Sin límite",
    })
  }

  return (
    <li className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-center sm:gap-4">
      <div className="min-w-0 space-y-2">
        <div className="flex items-center gap-3">
          <IconChip icon={category.icon} color={category.color} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-sm font-medium">
              {category.name}
              {category.system && <Lock className="size-3 text-muted-foreground" aria-label="Categoría del sistema" />}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              Este mes {formatMoney(projected)}
              {/* El promedio solo aporta si la persona anota sus gastos (complemento del registro). */}
              {average > 0 && <> · Promedio {formatMoney(average)}</>}
            </p>
          </div>
          <StatusBadge status={status} className="hidden md:inline-flex" />
        </div>
        <BudgetBar spent={spent} pending={pendingFixed} limit={limit} status={status} label={`Presupuesto de ${category.name}`} />
      </div>

      <div className="flex items-center gap-1">
        <MoneyInput
          aria-label={`Límite mensual de ${category.name}`}
          placeholder="Sin límite"
          value={draft}
          onValueChange={setDraft}
          onBlur={() => commit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur()
            if (e.key === "Escape") setDraft(limit ? String(limit) : "")
          }}
        />
      </div>

      <div className="flex items-center justify-end gap-1">
        {suggested > 0 && suggested !== limit && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Usar promedio (${formatMoney(suggested)}) como límite`}
                onClick={() => {
                  setDraft(String(suggested))
                  commit(String(suggested))
                }}
              >
                <Sparkles />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Usar promedio: {formatMoney(suggested)}</TooltipContent>
          </Tooltip>
        )}
        <CategoryMenu category={category} onEdit={onEdit} onDelete={onDelete} />
      </div>
    </li>
  )
}

function CategoryMenu({ category, onEdit, onDelete }: { category: Category; onEdit: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon-sm" variant="ghost" aria-label={`Acciones de ${category.name}`}>
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil /> Editar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={category.system} onSelect={onDelete}>
          <Trash2 /> {category.system ? "No se puede eliminar" : "Eliminar"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
