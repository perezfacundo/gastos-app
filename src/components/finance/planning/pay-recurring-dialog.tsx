"use client"

import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { financeActions } from "@/lib/finance/actions"
import type { MonthPlan, RecurringOccurrence } from "@/lib/finance/calculations"
import { formatMoney, isValidISODate, todayISO } from "@/lib/finance/format"

import { Field, MoneyInput, parseAmount } from "../shared/form-fields"

interface PayRecurringDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  formKey: number
  occurrence: RecurringOccurrence | null
  plan: MonthPlan
}

/**
 * Confirmar el pago (o cobro) de un fijo con el MONTO REAL.
 * Un toque si el monto es el previsto; editable si la factura vino distinta.
 */
export function PayRecurringDialog({ open, onOpenChange, formKey, occurrence, plan }: PayRecurringDialogProps) {
  const budget = plan.budgets.rows.find((r) => r.category.id === occurrence?.item.categoryId)
  const income = occurrence?.item.type === "income"
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{income ? "Confirmar cobro" : "Confirmar pago"}</DialogTitle>
          <DialogDescription>{occurrence?.item.description}</DialogDescription>
        </DialogHeader>
        {occurrence && (
          <PayForm
            key={formKey}
            occurrence={occurrence}
            plan={plan}
            categoryLimit={budget?.limit ?? 0}
            categoryName={budget?.category.name}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function PayForm({
  occurrence,
  plan,
  categoryLimit,
  categoryName,
  onDone,
}: {
  occurrence: RecurringOccurrence
  plan: MonthPlan
  categoryLimit: number
  categoryName?: string
  onDone: () => void
}) {
  const { item } = occurrence
  const today = todayISO()
  // Si se paga antes de la fecha prevista en el mes actual, se registra hoy.
  const suggestedDate = plan.timing === "current" && occurrence.date > today ? today : occurrence.date

  const [amount, setAmount] = useState(String(item.amount))
  const [date, setDate] = useState(suggestedDate)
  const [updatePlanned, setUpdatePlanned] = useState(false)
  const [error, setError] = useState<string>()

  const numeric = parseAmount(amount)
  const differs = Number.isFinite(numeric) && numeric > 0 && numeric !== item.amount
  // Si un gasto fijo aumenta (inflación), su categoría necesita el mismo margen extra.
  const delta = differs ? numeric - item.amount : 0
  const adjustsLimit = item.type === "expense" && delta > 0 && categoryLimit > 0

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!Number.isFinite(numeric) || numeric <= 0) return setError("Ingresá un monto mayor a 0.")
    if (!isValidISODate(date)) return setError("Elegí una fecha válida.")

    const tx = financeActions.registerRecurring(item, plan.month, date, numeric)
    if (differs && updatePlanned) {
      financeActions.saveRecurring({ ...item, amount: numeric }, item.id)
      if (adjustsLimit) financeActions.setCategoryLimit(item.categoryId, categoryLimit + delta)
    }
    toast.success(`${item.type === "income" ? "Cobro" : "Pago"} registrado`, {
      description: `${item.description} · ${formatMoney(numeric)}${differs ? ` (previsto ${formatMoney(item.amount)})` : ""}`,
      action: { label: "Deshacer", onClick: () => financeActions.removeTransaction(tx.id) },
    })
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field label="Monto real" error={error}>
          {(p) => <MoneyInput {...p} autoFocus value={amount} onValueChange={setAmount} />}
        </Field>
        <Field label="Fecha">
          {(p) => <Input {...p} type="date" className="w-auto" value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
      </div>

      {differs && (
        <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
          <div>
            <Label htmlFor="update-planned">Usar {formatMoney(numeric)} en los próximos meses</Label>
            <p className="text-xs text-muted-foreground">
              Hoy está previsto en {formatMoney(item.amount)}.
              {adjustsLimit && ` El límite de ${categoryName ?? "la categoría"} sube ${formatMoney(delta)}.`}
            </p>
          </div>
          <Switch id="update-planned" checked={updatePlanned} onCheckedChange={setUpdatePlanned} />
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit">Confirmar</Button>
      </DialogFooter>
    </form>
  )
}
