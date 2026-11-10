"use client"

import { ChevronDown, ChevronUp, Trash2, TriangleAlert } from "lucide-react"
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
import { Label } from "@/components/ui/label"
import { financeActions } from "@/lib/finance/actions"
import { budgetStatus, categoryBudgets } from "@/lib/finance/calculations"
import { formatMoney, formatMoneyPrecise, formatPercent, isValidISODate, monthKeyOf, parseISODate, todayISO, toISODate } from "@/lib/finance/format"
import { descriptionSuggestions, rankCategories } from "@/lib/finance/suggestions"
import type { FinanceState, ISODate, Transaction, TransactionType } from "@/lib/finance/types"
import { readPref, writePref } from "@/lib/preferences"
import { cn } from "@/lib/utils"

import { IconChip } from "../shared/category-icon"
import { Field, parseAmount, TypeToggle } from "../shared/form-fields"

/** Cuántas categorías se muestran antes de "Ver todas". */
const VISIBLE_CATEGORIES = 8

interface TransactionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  formKey: number
  state: FinanceState
  defaultDate: ISODate
  /** Si viene, el diálogo edita ese movimiento. */
  transaction?: Transaction | null
}

export function TransactionFormDialog({ open, onOpenChange, formKey, state, defaultDate, transaction }: TransactionFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* En el celular se ancla arriba (el teclado no lo tapa) y scrollea por dentro. */}
      <DialogContent className="top-4 max-h-[calc(100dvh-2rem)] translate-y-0 overflow-y-auto sm:top-1/2 sm:max-w-md sm:-translate-y-1/2">
        <DialogHeader>
          <DialogTitle>{transaction ? "Editar movimiento" : "Nuevo movimiento"}</DialogTitle>
          <DialogDescription className="sr-only">Monto, categoría, descripción opcional y fecha.</DialogDescription>
        </DialogHeader>
        <TransactionForm
          key={formKey}
          state={state}
          defaultDate={defaultDate}
          original={transaction ?? null}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

type Errors = Partial<Record<"amount" | "categoryId" | "date", string>>

const yesterdayISO = () => {
  const d = parseISODate(todayISO())
  d.setDate(d.getDate() - 1)
  return toISODate(d)
}

function TransactionForm({
  state,
  defaultDate,
  original,
  onDone,
}: {
  state: FinanceState
  defaultDate: ISODate
  original: Transaction | null
  onDone: () => void
}) {
  /** Categoría inicial: la última usada en este dispositivo, o la más usada. */
  const initialCategory = (kind: TransactionType) => {
    const ranked = rankCategories(state, kind)
    const last = readPref<string | null>(`last-category:${kind}`, null)
    return ranked.find((c) => c.id === last)?.id ?? ranked[0]?.id ?? ""
  }

  const [type, setType] = useState<TransactionType>(original?.type ?? "expense")
  const [amount, setAmount] = useState(original ? String(original.amount) : "")
  const [categoryId, setCategoryId] = useState(() => original?.categoryId ?? initialCategory("expense"))
  const [description, setDescription] = useState(original?.description ?? "")
  const [date, setDate] = useState<ISODate>(original?.date ?? defaultDate)
  const [showAllCategories, setShowAllCategories] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [errors, setErrors] = useState<Errors>({})

  const ranked = useMemo(() => rankCategories(state, type), [state, type])
  const selectedIndex = ranked.findIndex((c) => c.id === categoryId)
  // Siempre mostrar la categoría elegida aunque esté fuera de las primeras 8.
  const visible =
    showAllCategories || selectedIndex < VISIBLE_CATEGORIES
      ? ranked.slice(0, showAllCategories ? undefined : VISIBLE_CATEGORIES)
      : [...ranked.slice(0, VISIBLE_CATEGORIES - 1), ranked[selectedIndex]]
  const selectedCategory = ranked[selectedIndex]

  const suggestions = useMemo(() => descriptionSuggestions(state, type, description), [state, type, description])

  const numericAmount = parseAmount(amount)
  const today = todayISO()
  const yesterday = yesterdayISO()

  // Presupuesto disponible en la categoría (al editar, sin contar el monto original).
  const budget = useMemo(() => {
    if (type !== "expense" || !isValidISODate(date)) return undefined
    const row = categoryBudgets(state, monthKeyOf(date)).find((r) => r.category.id === categoryId)
    if (!row) return undefined
    const sameBucket =
      original?.type === "expense" && original.categoryId === categoryId && monthKeyOf(original.date) === monthKeyOf(date)
    const baseline = sameBucket ? original.amount : 0
    return { ...row, projected: row.projected - baseline, remaining: row.remaining + baseline }
  }, [state, type, date, categoryId, original])

  const exceedsBy =
    budget && budget.limit > 0 && Number.isFinite(numericAmount) ? numericAmount - Math.max(0, budget.remaining) : 0

  function changeType(next: TransactionType) {
    setType(next)
    setCategoryId(initialCategory(next))
    setShowAllCategories(false)
  }

  function applySuggestion(s: (typeof suggestions)[number]) {
    setDescription(s.description)
    setCategoryId(s.categoryId)
    if (!amount) setAmount(String(s.amount))
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const found: Errors = {}
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) found.amount = "Ingresá un monto mayor a 0."
    if (!categoryId) found.categoryId = "Elegí una categoría."
    if (!isValidISODate(date)) found.date = "Elegí una fecha válida."
    setErrors(found)
    if (Object.keys(found).length) return

    const input = {
      // Descripción opcional: si no se escribe, se usa el nombre de la categoría.
      description: description.trim() || selectedCategory?.name || "Movimiento",
      amount: numericAmount,
      type,
      categoryId,
      date,
      recurringId: original?.recurringId,
    }
    writePref(`last-category:${type}`, categoryId)

    if (original) {
      financeActions.updateTransaction(original, input)
      toast.success("Movimiento actualizado")
    } else {
      const tx = financeActions.addTransaction(input)
      toast.success(`${type === "income" ? "Ingreso" : "Gasto"} registrado`, {
        description: `${tx.description} · ${formatMoneyPrecise(tx.amount)}`,
        action: { label: "Deshacer", onClick: () => financeActions.removeTransaction(tx.id) },
      })
    }

    // Alerta si el gasto empuja la categoría a "cerca del límite" o "excedido".
    if (budget && budget.limit > 0) {
      const projected = budget.projected + numericAmount
      const status = budgetStatus(projected, budget.limit, budget.fixedCommitted)
      const before = budgetStatus(budget.projected, budget.limit, budget.fixedCommitted)
      if (status !== "ok" && status !== before) {
        toast.warning(
          status === "over" ? `${budget.category.name} superó su límite` : `${budget.category.name} está cerca del límite`,
          { description: `${formatPercent(projected / budget.limit)} de ${formatMoney(budget.limit)}` }
        )
      }
    }
    onDone()
  }

  function handleDelete() {
    if (!original) return
    financeActions.removeTransaction(original.id)
    toast(`Se eliminó “${original.description}”`, {
      action: { label: "Deshacer", onClick: () => financeActions.restoreTransaction(original) },
    })
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      <TypeToggle value={type} onValueChange={changeType} />

      {/* 1. Monto: lo primero que sabés al pagar. */}
      <Field label="Monto" error={errors.amount}>
        {(p) => (
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-2xl text-muted-foreground">$</span>
            <Input
              {...p}
              autoFocus
              type="number"
              inputMode="decimal"
              enterKeyHint="done"
              min={0}
              step="any"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-14 pl-8 text-3xl font-semibold tabular-nums md:text-3xl"
            />
          </div>
        )}
      </Field>

      {/* 2. Categoría: un toque, las más usadas primero. */}
      <div className="grid gap-1.5">
        <Label id="category-label">Categoría</Label>
        <div role="radiogroup" aria-labelledby="category-label" className="grid grid-cols-4 gap-1.5">
          {visible.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={c.id === categoryId}
              onClick={() => setCategoryId(c.id)}
              className={cn(
                "flex min-w-0 flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11px] leading-tight transition outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                c.id === categoryId ? "border-foreground bg-muted font-medium" : "border-transparent"
              )}
            >
              <IconChip icon={c.icon} color={c.color} size="sm" />
              <span className="w-full truncate text-center">{c.name}</span>
            </button>
          ))}
        </div>
        {ranked.length > VISIBLE_CATEGORIES && (
          <Button type="button" variant="ghost" size="xs" className="justify-self-center" onClick={() => setShowAllCategories((v) => !v)}>
            {showAllCategories ? <ChevronUp data-icon="inline-start" /> : <ChevronDown data-icon="inline-start" />}
            {showAllCategories ? "Ver menos" : `Ver todas (${ranked.length})`}
          </Button>
        )}
        {errors.categoryId && <p className="text-xs text-bad-ink">{errors.categoryId}</p>}
        {budget && budget.limit > 0 && (
          <p className={cn("text-xs", exceedsBy > 0 ? "text-warn-ink" : "text-muted-foreground")}>
            {exceedsBy > 0 ? (
              <span className="inline-flex items-center gap-1">
                <TriangleAlert className="size-3.5" aria-hidden="true" />
                Supera lo disponible en {budget.category.name} por {formatMoney(exceedsBy)}.
              </span>
            ) : (
              <>
                Disponible en {budget.category.name}: <strong>{formatMoney(Math.max(0, budget.remaining))}</strong>
              </>
            )}
          </p>
        )}
      </div>

      {/* 3. Descripción opcional, con autocompletado del historial. */}
      <Field label="Descripción (opcional)">
        {(p) => (
          <div className="grid gap-1.5">
            <Input
              {...p}
              maxLength={60}
              autoComplete="off"
              placeholder={selectedCategory ? `Ej.: ${selectedCategory.name}` : "Ej.: Supermercado"}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5" aria-label="Sugerencias">
                {suggestions.map((s) => (
                  <Button key={s.description} type="button" size="xs" variant="secondary" onClick={() => applySuggestion(s)}>
                    {s.description} · {formatMoney(s.amount)}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
      </Field>

      {/* 4. Fecha: hoy por defecto; ayer a un toque. */}
      <div className="grid gap-1.5">
        <Label>Fecha</Label>
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { label: "Hoy", value: today },
            { label: "Ayer", value: yesterday },
          ].map((opt) => (
            <Button
              key={opt.label}
              type="button"
              size="sm"
              variant={date === opt.value && !showDatePicker ? "default" : "outline"}
              onClick={() => {
                setDate(opt.value)
                setShowDatePicker(false)
              }}
            >
              {opt.label}
            </Button>
          ))}
          {showDatePicker || (date !== today && date !== yesterday) ? (
            <Input
              type="date"
              aria-label="Otra fecha"
              aria-invalid={errors.date ? true : undefined}
              className="w-auto"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          ) : (
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowDatePicker(true)}>
              Otra fecha
            </Button>
          )}
        </div>
        {errors.date && <p className="text-xs text-bad-ink">{errors.date}</p>}
      </div>

      <DialogFooter className="gap-2 sm:justify-between">
        {original ? (
          <Button type="button" variant="ghost" className="text-destructive sm:mr-auto" onClick={handleDelete}>
            <Trash2 data-icon="inline-start" />
            Eliminar
          </Button>
        ) : (
          <span className="hidden sm:block" />
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={onDone}>
            Cancelar
          </Button>
          <Button type="submit">{original ? "Guardar cambios" : "Guardar"}</Button>
        </div>
      </DialogFooter>
    </form>
  )
}
