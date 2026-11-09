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
import type { FinanceState, RecurringItem, TransactionType } from "@/lib/finance/types"

import { CategorySelect, Field, MoneyInput, parseAmount, TypeToggle } from "../shared/form-fields"

interface RecurringFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  formKey: number
  state: FinanceState
  item: RecurringItem | null
}

export function RecurringFormDialog({ open, onOpenChange, formKey, state, item }: RecurringFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? "Editar fijo" : "Nuevo gasto o ingreso fijo"}</DialogTitle>
          <DialogDescription>
            Se repite todos los meses y se descuenta automáticamente del presupuesto proyectado hasta que lo registres.
          </DialogDescription>
        </DialogHeader>
        <RecurringForm key={formKey} state={state} item={item} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

type Errors = Partial<Record<"description" | "amount" | "categoryId" | "day", string>>

function RecurringForm({ state, item, onDone }: { state: FinanceState; item: RecurringItem | null; onDone: () => void }) {
  const firstOf = (kind: TransactionType) => state.categories.find((c) => c.kind === kind)?.id ?? ""

  const [type, setType] = useState<TransactionType>(item?.type ?? "expense")
  const [description, setDescription] = useState(item?.description ?? "")
  const [amount, setAmount] = useState(item ? String(item.amount) : "")
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? firstOf("expense"))
  const [day, setDay] = useState(item ? String(item.dayOfMonth) : "1")
  const [active, setActive] = useState(item?.active ?? true)
  const [errors, setErrors] = useState<Errors>({})

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const numericAmount = parseAmount(amount)
    const numericDay = Number(day)
    const found: Errors = {}
    if (!description.trim()) found.description = "Ingresá una descripción."
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) found.amount = "Ingresá un monto mayor a 0."
    if (!categoryId) found.categoryId = "Elegí una categoría."
    if (!Number.isInteger(numericDay) || numericDay < 1 || numericDay > 31) found.day = "Entre 1 y 31."
    setErrors(found)
    if (Object.keys(found).length) return

    financeActions.saveRecurring(
      { description, amount: numericAmount, type, categoryId, dayOfMonth: numericDay, active },
      item?.id
    )
    toast.success(item ? "Fijo actualizado" : "Fijo agregado", { description: description.trim() })
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      <TypeToggle
        value={type}
        onValueChange={(next) => {
          setType(next)
          setCategoryId(firstOf(next))
        }}
      />

      <Field label="Descripción" error={errors.description}>
        {(p) => (
          <Input
            {...p}
            autoFocus
            maxLength={60}
            placeholder="Ej.: Alquiler"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        )}
      </Field>

      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <Field label="Monto mensual" error={errors.amount}>
          {(p) => <MoneyInput {...p} value={amount} onValueChange={setAmount} />}
        </Field>
        <Field label="Día del mes" error={errors.day}>
          {(p) => (
            <Input {...p} type="number" min={1} max={31} inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value)} />
          )}
        </Field>
      </div>

      <Field label="Categoría" error={errors.categoryId}>
        {(p) => (
          <CategorySelect
            id={p.id}
            categories={state.categories}
            kind={type}
            value={categoryId}
            onValueChange={setCategoryId}
          />
        )}
      </Field>

      <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5">
        <div>
          <Label htmlFor="recurring-active">Activo</Label>
          <p className="text-xs text-muted-foreground">Si lo pausás, deja de proyectarse en los próximos meses.</p>
        </div>
        <Switch id="recurring-active" checked={active} onCheckedChange={setActive} />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit">{item ? "Guardar cambios" : "Agregar fijo"}</Button>
      </DialogFooter>
    </form>
  )
}
