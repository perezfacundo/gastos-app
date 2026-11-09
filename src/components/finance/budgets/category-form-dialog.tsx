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
import { financeActions } from "@/lib/finance/actions"
import type { Category, CategoryColor, FinanceState, TransactionType } from "@/lib/finance/types"

import { IconChip } from "../shared/category-icon"
import { ColorPicker, Field, IconPicker, MoneyInput, parseAmount, TypeToggle } from "../shared/form-fields"

interface CategoryFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  formKey: number
  state: FinanceState
  category: Category | null
}

export function CategoryFormDialog({ open, onOpenChange, formKey, state, category }: CategoryFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{category ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
          <DialogDescription>Las categorías de gasto pueden tener un límite mensual.</DialogDescription>
        </DialogHeader>
        <CategoryForm key={formKey} state={state} category={category} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function CategoryForm({
  state,
  category,
  onDone,
}: {
  state: FinanceState
  category: Category | null
  onDone: () => void
}) {
  const [kind, setKind] = useState<TransactionType>(category?.kind ?? "expense")
  const [name, setName] = useState(category?.name ?? "")
  const [icon, setIcon] = useState(category?.icon ?? "package")
  const [color, setColor] = useState<CategoryColor>(category?.color ?? "blue")
  const [limit, setLimit] = useState(category?.monthlyLimit ? String(category.monthlyLimit) : "")
  const [errors, setErrors] = useState<{ name?: string; limit?: string }>({})

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const numericLimit = limit.trim() === "" ? 0 : parseAmount(limit)
    const trimmed = name.trim()
    const duplicate = state.categories.some(
      (c) => c.id !== category?.id && c.kind === kind && c.name.toLowerCase() === trimmed.toLowerCase()
    )
    const found: typeof errors = {}
    if (!trimmed) found.name = "Ingresá un nombre."
    else if (duplicate) found.name = "Ya existe una categoría con ese nombre."
    if (!Number.isFinite(numericLimit) || numericLimit < 0) found.limit = "Ingresá un monto válido (o dejalo vacío)."
    setErrors(found)
    if (Object.keys(found).length) return

    financeActions.saveCategory(
      {
        name: trimmed,
        icon,
        color,
        kind,
        monthlyLimit: kind === "expense" ? numericLimit : 0,
        system: category?.system,
      },
      category?.id
    )
    toast.success(category ? "Categoría actualizada" : "Categoría creada", { description: trimmed })
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      {!category && <TypeToggle value={kind} onValueChange={setKind} />}

      <div className="flex items-end gap-3">
        <IconChip icon={icon} color={color} size="lg" />
        <Field label="Nombre" error={errors.name} className="flex-1">
          {(p) => (
            <Input {...p} autoFocus maxLength={30} placeholder="Ej.: Mascotas" value={name} onChange={(e) => setName(e.target.value)} />
          )}
        </Field>
      </div>

      <div className="grid gap-1.5">
        <Label>Ícono</Label>
        <IconPicker value={icon} color={color} onValueChange={setIcon} />
      </div>

      <div className="grid gap-1.5">
        <Label>Color</Label>
        <ColorPicker value={color} onValueChange={setColor} />
      </div>

      {kind === "expense" && (
        <Field label="Límite mensual" error={errors.limit} hint="Dejalo vacío si no querés ponerle tope.">
          {(p) => <MoneyInput {...p} value={limit} onValueChange={setLimit} />}
        </Field>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit">{category ? "Guardar cambios" : "Crear categoría"}</Button>
      </DialogFooter>
    </form>
  )
}
