"use client"

import { TriangleAlert } from "lucide-react"
import { useMemo, useState } from "react"
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
import { financeActions } from "@/lib/finance/actions"
import { budgetStatus, categoryBudgets } from "@/lib/finance/calculations"
import { formatMoney, formatPercent, isValidISODate, monthKeyOf } from "@/lib/finance/format"
import type { FinanceState, ISODate, TransactionType } from "@/lib/finance/types"

import { CategorySelect, Field, MoneyInput, parseAmount, TypeToggle } from "../shared/form-fields"

interface TransactionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  formKey: number
  state: FinanceState
  defaultDate: ISODate
}

export function TransactionFormDialog({ open, onOpenChange, formKey, state, defaultDate }: TransactionFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo movimiento</DialogTitle>
          <DialogDescription>Registrá un gasto o ingreso real para compararlo con tu plan.</DialogDescription>
        </DialogHeader>
        <TransactionForm key={formKey} state={state} defaultDate={defaultDate} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

type Errors = Partial<Record<"description" | "amount" | "categoryId" | "date", string>>

function TransactionForm({
  state,
  defaultDate,
  onDone,
}: {
  state: FinanceState
  defaultDate: ISODate
  onDone: () => void
}) {
  const firstOf = (kind: TransactionType) => state.categories.find((c) => c.kind === kind)?.id ?? ""

  const [type, setType] = useState<TransactionType>("expense")
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [categoryId, setCategoryId] = useState(() => firstOf("expense"))
  const [date, setDate] = useState<ISODate>(defaultDate)
  const [errors, setErrors] = useState<Errors>({})

  // Vista previa del presupuesto de la categoría en el mes de la fecha elegida.
  const budget = useMemo(() => {
    if (type !== "expense" || !isValidISODate(date)) return undefined
    return categoryBudgets(state, monthKeyOf(date)).find((r) => r.category.id === categoryId)
  }, [state, type, date, categoryId])

  const numericAmount = parseAmount(amount)
  const exceedsBy =
    budget && budget.limit > 0 && Number.isFinite(numericAmount) ? numericAmount - Math.max(0, budget.remaining) : 0

  function changeType(next: TransactionType) {
    setType(next)
    setCategoryId(firstOf(next))
  }

  function validate(): Errors {
    const e: Errors = {}
    if (!description.trim()) e.description = "Ingresá una descripción."
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) e.amount = "Ingresá un monto mayor a 0."
    if (!categoryId) e.categoryId = "Elegí una categoría."
    if (!isValidISODate(date)) e.date = "Elegí una fecha válida."
    return e
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length) return

    const tx = financeActions.addTransaction({ description, amount: numericAmount, type, categoryId, date })
    toast.success(`${type === "income" ? "Ingreso" : "Gasto"} registrado`, {
      description: `${tx.description} · ${formatMoney(tx.amount)}`,
    })

    // Alerta si el gasto empuja la categoría a "cerca del límite" o "excedido".
    if (budget && budget.limit > 0) {
      const projected = budget.projected + tx.amount
      const status = budgetStatus(projected, budget.limit)
      if (status !== "ok" && status !== budget.status) {
        toast.warning(
          status === "over"
            ? `${budget.category.name} superó su presupuesto`
            : `${budget.category.name} está cerca del límite`,
          { description: `${formatPercent(projected / budget.limit)} del límite de ${formatMoney(budget.limit)}` }
        )
      }
    }
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      <TypeToggle value={type} onValueChange={changeType} />

      <Field label="Descripción" error={errors.description}>
        {(p) => (
          <Input
            {...p}
            autoFocus
            maxLength={60}
            placeholder={type === "expense" ? "Ej.: Supermercado" : "Ej.: Proyecto freelance"}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Monto" error={errors.amount}>
          {(p) => <MoneyInput {...p} value={amount} onValueChange={setAmount} />}
        </Field>
        <Field label="Fecha" error={errors.date}>
          {(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
      </div>

      <Field
        label="Categoría"
        error={errors.categoryId}
        hint={
          budget && budget.limit > 0 ? (
            exceedsBy > 0 ? (
              <span className="inline-flex items-center gap-1 text-warn-ink">
                <TriangleAlert className="size-3.5" aria-hidden="true" />
                Este gasto supera lo disponible por {formatMoney(exceedsBy)}.
              </span>
            ) : (
              <span>
                Disponible en {budget.category.name}: <strong>{formatMoney(Math.max(0, budget.remaining))}</strong> de{" "}
                {formatMoney(budget.limit)} (ya descontados los fijos).
              </span>
            )
          ) : undefined
        }
      >
        {(p) => (
          <CategorySelect
            id={p.id}
            aria-invalid={p["aria-invalid"]}
            categories={state.categories}
            kind={type}
            value={categoryId}
            onValueChange={setCategoryId}
          />
        )}
      </Field>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit">Guardar movimiento</Button>
      </DialogFooter>
    </form>
  )
}
