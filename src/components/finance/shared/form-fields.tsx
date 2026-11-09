"use client"

import { useId } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CATEGORY_COLORS, COLOR_LABEL, colorVar } from "@/lib/finance/config"
import type { Category, CategoryColor, TransactionType } from "@/lib/finance/types"
import { cn } from "@/lib/utils"

import { ICON_KEYS, ICONS, IconChip } from "./category-icon"

/* ----------------------------------------------------------------------------
 * Campo con etiqueta + mensaje de error accesible
 * ------------------------------------------------------------------------- */

interface FieldProps {
  label: string
  error?: string
  hint?: React.ReactNode
  className?: string
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => React.ReactNode
}

export function Field({ label, error, hint, className, children }: FieldProps) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-bad-ink">
          {error}
        </p>
      ) : hint ? (
        <div id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </div>
      ) : null}
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * Monto con prefijo de moneda
 * ------------------------------------------------------------------------- */

type MoneyInputProps = Omit<React.ComponentProps<typeof Input>, "type" | "value" | "onChange"> & {
  value: string
  onValueChange: (value: string) => void
}

export function MoneyInput({ value, onValueChange, className, ...props }: MoneyInputProps) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground">
        $
      </span>
      <Input
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        placeholder="0"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className={cn("pl-6 tabular-nums", className)}
        {...props}
      />
    </div>
  )
}

/** Convierte el texto de un MoneyInput en número (NaN si no es válido). */
export const parseAmount = (raw: string) => (raw.trim() === "" ? Number.NaN : Number(raw))

/* ----------------------------------------------------------------------------
 * Selector de categoría (filtrado por tipo)
 * ------------------------------------------------------------------------- */

interface CategorySelectProps {
  categories: Category[]
  kind?: TransactionType
  value: string
  onValueChange: (value: string) => void
  id?: string
  placeholder?: string
  /** Opción extra "Todas" para filtros. */
  allLabel?: string
  className?: string
  "aria-invalid"?: boolean
}

export function CategorySelect({
  categories,
  kind,
  value,
  onValueChange,
  id,
  placeholder = "Elegí una categoría",
  allLabel,
  className,
  ...aria
}: CategorySelectProps) {
  const options = kind ? categories.filter((c) => c.kind === kind) : categories
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger id={id} className={cn("w-full", className)} {...aria}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allLabel && <SelectItem value="all">{allLabel}</SelectItem>}
        {options.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            <IconChip icon={c.icon} color={c.color} size="sm" className="size-5 rounded" />
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/* ----------------------------------------------------------------------------
 * Selector Gasto / Ingreso (control segmentado accesible)
 * ------------------------------------------------------------------------- */

export function TypeToggle({
  value,
  onValueChange,
}: {
  value: TransactionType
  onValueChange: (value: TransactionType) => void
}) {
  const options: { value: TransactionType; label: string }[] = [
    { value: "expense", label: "Gasto" },
    { value: "income", label: "Ingreso" },
  ]
  return (
    <div role="radiogroup" aria-label="Tipo" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onValueChange(o.value)}
          className={cn(
            "rounded-md py-1.5 text-sm font-medium text-muted-foreground transition outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            value === o.value && "bg-background text-foreground shadow-sm"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * Selectores de ícono y color
 * ------------------------------------------------------------------------- */

export function IconPicker({
  value,
  color,
  onValueChange,
}: {
  value: string
  color: CategoryColor
  onValueChange: (icon: string) => void
}) {
  return (
    <div role="radiogroup" aria-label="Ícono" className="grid grid-cols-7 gap-1.5 sm:grid-cols-9">
      {ICON_KEYS.map((key) => {
        const Icon = ICONS[key]
        const selected = key === value
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={key}
            onClick={() => onValueChange(key)}
            className={cn(
              "grid aspect-square place-items-center rounded-md text-muted-foreground transition outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
              selected && "ring-2 ring-foreground"
            )}
            style={selected ? { color: colorVar(color) } : undefined}
          >
            <Icon className="size-4" />
          </button>
        )
      })}
    </div>
  )
}

export function ColorPicker({ value, onValueChange }: { value: CategoryColor; onValueChange: (c: CategoryColor) => void }) {
  return (
    <div role="radiogroup" aria-label="Color" className="flex flex-wrap gap-2">
      {CATEGORY_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={COLOR_LABEL[color]}
          title={COLOR_LABEL[color]}
          onClick={() => onValueChange(color)}
          className={cn(
            "size-7 rounded-full ring-offset-2 ring-offset-background transition outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            value === color && "ring-2 ring-foreground"
          )}
          style={{ backgroundColor: colorVar(color) }}
        />
      ))}
    </div>
  )
}
