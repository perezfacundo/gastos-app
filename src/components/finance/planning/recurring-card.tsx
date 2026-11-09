"use client"

import { CalendarClock, CircleCheck, CirclePause, Ellipsis, Pencil, Plus, Trash2, TriangleAlert, type LucideIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { financeActions } from "@/lib/finance/actions"
import type { MonthPlan, RecurringOccurrence } from "@/lib/finance/calculations"
import { formatMoney, parseISODate, todayISO } from "@/lib/finance/format"
import type { Category, FinanceState, RecurringItem } from "@/lib/finance/types"
import { cn } from "@/lib/utils"

import { IconChip } from "../shared/category-icon"
import { EmptyState, useDialogState } from "../shared/misc"
import { RecurringFormDialog } from "./recurring-form-dialog"

const OCCURRENCE_META: Record<RecurringOccurrence["status"], { label: (income: boolean) => string; icon: LucideIcon; className: string }> = {
  paid: { label: (i) => (i ? "Cobrado" : "Pagado"), icon: CircleCheck, className: "bg-good/10 text-good-ink" },
  pending: { label: () => "Pendiente", icon: CalendarClock, className: "bg-muted text-muted-foreground" },
  overdue: { label: () => "Vencido", icon: TriangleAlert, className: "bg-warn/15 text-warn-ink" },
  missed: { label: () => "No registrado", icon: CirclePause, className: "bg-muted text-muted-foreground" },
}

interface RecurringCardProps {
  state: FinanceState
  plan: MonthPlan
  categoryMap: Map<string, Category>
}

/** Fijos del mes: lo que ya se pagó/cobró y lo que se proyecta automáticamente. */
export function RecurringCard({ state, plan, categoryMap }: RecurringCardProps) {
  const dialog = useDialogState<RecurringItem>()
  const occurrences = plan.recurring
  const occurrenceIds = new Set(occurrences.map((o) => o.item.id))
  const paused = state.recurring.filter((r) => !r.active && !occurrenceIds.has(r.id))

  const fixedIncome = occurrences.filter((o) => o.item.type === "income" && o.status !== "missed").reduce((s, o) => s + o.item.amount, 0)
  const fixedExpense = occurrences.filter((o) => o.item.type === "expense" && o.status !== "missed").reduce((s, o) => s + o.item.amount, 0)

  function register(o: RecurringOccurrence) {
    const today = todayISO()
    // Si se paga antes de la fecha prevista en el mes actual, se registra hoy.
    const date = plan.timing === "current" && o.date > today ? today : o.date
    const tx = financeActions.registerRecurring(o.item, plan.month, date)
    toast.success(`${o.item.type === "income" ? "Cobro" : "Pago"} registrado`, {
      description: `${o.item.description} · ${formatMoney(o.item.amount)}`,
      action: { label: "Deshacer", onClick: () => financeActions.removeTransaction(tx.id) },
    })
  }

  function remove(item: RecurringItem) {
    const removed = financeActions.removeRecurring(item.id)
    if (!removed) return
    toast(`Se eliminó “${removed.description}”`, {
      description: "Los pagos ya registrados se conservan.",
      action: { label: "Deshacer", onClick: () => financeActions.restoreRecurring(removed) },
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fijos del mes</CardTitle>
        <CardDescription className="tabular-nums">
          Ingresos {formatMoney(fixedIncome)} · Gastos {formatMoney(fixedExpense)}
        </CardDescription>
        <CardAction>
          <Button size="sm" variant="outline" onClick={() => dialog.openWith(null)}>
            <Plus data-icon="inline-start" />
            Nuevo fijo
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {occurrences.length === 0 && paused.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="Sin gastos ni ingresos fijos"
            description="Cargá alquiler, sueldo o suscripciones: se descuentan solos del presupuesto proyectado."
          />
        ) : (
          <ul className="-mx-2 divide-y">
            {occurrences.map((o) => (
              <OccurrenceRow
                key={o.item.id}
                occurrence={o}
                category={categoryMap.get(o.item.categoryId)}
                onRegister={() => register(o)}
                onEdit={() => dialog.openWith(o.item)}
                onRemove={() => remove(o.item)}
              />
            ))}
            {paused.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-2 py-2.5 opacity-60">
                <span className="w-8 text-center text-xs text-muted-foreground">—</span>
                <p className="min-w-0 flex-1 truncate text-sm">{item.description}</p>
                <Badge variant="outline">Pausado</Badge>
                <ItemMenu onEdit={() => dialog.openWith(item)} onRemove={() => remove(item)} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <RecurringFormDialog
        open={dialog.open}
        onOpenChange={dialog.setOpen}
        formKey={dialog.key}
        state={state}
        item={dialog.item}
      />
    </Card>
  )
}

function OccurrenceRow({
  occurrence,
  category,
  onRegister,
  onEdit,
  onRemove,
}: {
  occurrence: RecurringOccurrence
  category?: Category
  onRegister: () => void
  onEdit: () => void
  onRemove: () => void
}) {
  const { item, date, status } = occurrence
  const isIncome = item.type === "income"
  const meta = OCCURRENCE_META[status]
  const StatusIcon = meta.icon
  const canRegister = status === "pending" || status === "overdue"

  return (
    <li className="flex items-center gap-3 px-2 py-2.5">
      <div className="w-8 shrink-0 text-center leading-none">
        <p className="text-sm font-semibold tabular-nums">{parseISODate(date).getDate()}</p>
        <p className="text-[10px] uppercase text-muted-foreground">día</p>
      </div>
      {category && <IconChip icon={category.icon} color={category.color} size="sm" />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.description}</p>
        <p className={cn("text-xs tabular-nums", isIncome ? "text-good-ink" : "text-muted-foreground")}>
          {isIncome ? "+" : "−"} {formatMoney(item.amount)}
        </p>
      </div>
      {canRegister ? (
        <Button size="xs" variant={status === "overdue" ? "default" : "secondary"} onClick={onRegister}>
          {isIncome ? "Cobrar" : "Pagar"}
        </Button>
      ) : null}
      <Badge variant="outline" className={cn("hidden gap-1 border-transparent sm:inline-flex", meta.className)}>
        <StatusIcon aria-hidden="true" />
        {meta.label(isIncome)}
      </Badge>
      <ItemMenu onEdit={onEdit} onRemove={onRemove} />
    </li>
  )
}

function ItemMenu({ onEdit, onRemove }: { onEdit: () => void; onRemove: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon-sm" variant="ghost" aria-label="Más acciones">
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil /> Editar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onRemove}>
          <Trash2 /> Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
