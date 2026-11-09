"use client"

import { CalendarCheck, TriangleAlert } from "lucide-react"
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
import { Slider } from "@/components/ui/slider"
import { financeActions } from "@/lib/finance/actions"
import { simulateGoal, type GoalProgress } from "@/lib/finance/calculations"
import { formatMoney, formatMonthLabel, isValidISODate, monthKeyOf } from "@/lib/finance/format"
import type { CategoryColor, SavingsGoal } from "@/lib/finance/types"
import { cn } from "@/lib/utils"

import { IconChip } from "../shared/category-icon"
import { ColorPicker, Field, IconPicker, MoneyInput, parseAmount } from "../shared/form-fields"

/* ============================================================================
 * Crear / editar meta
 * ========================================================================= */

interface GoalFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  formKey: number
  goal: SavingsGoal | null
  /** Ahorrado actual (para la simulación en vivo al editar). */
  saved: number
}

export function GoalFormDialog({ open, onOpenChange, formKey, goal, saved }: GoalFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{goal ? "Editar meta" : "Nueva meta de ahorro"}</DialogTitle>
          <DialogDescription>
            El aporte mensual se reserva en tu plan de cada mes, antes de repartir el resto.
          </DialogDescription>
        </DialogHeader>
        <GoalForm key={formKey} goal={goal} saved={saved} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

type GoalErrors = Partial<Record<"name" | "target" | "monthly" | "deadline", string>>

function GoalForm({ goal, saved, onDone }: { goal: SavingsGoal | null; saved: number; onDone: () => void }) {
  const [name, setName] = useState(goal?.name ?? "")
  const [icon, setIcon] = useState(goal?.icon ?? "piggy")
  const [color, setColor] = useState<CategoryColor>(goal?.color ?? "aqua")
  const [target, setTarget] = useState(goal ? String(goal.targetAmount) : "")
  const [monthly, setMonthly] = useState(goal ? String(goal.monthlyContribution) : "")
  const [deadline, setDeadline] = useState(goal?.deadline ?? "")
  const [errors, setErrors] = useState<GoalErrors>({})

  const targetN = parseAmount(target)
  const monthlyN = monthly.trim() === "" ? 0 : parseAmount(monthly)
  const sim =
    Number.isFinite(targetN) && Number.isFinite(monthlyN) && targetN > 0
      ? simulateGoal(Math.max(0, targetN - saved), monthlyN)
      : null

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const found: GoalErrors = {}
    if (!name.trim()) found.name = "Ingresá un nombre."
    if (!Number.isFinite(targetN) || targetN <= 0) found.target = "Ingresá un monto objetivo."
    if (!Number.isFinite(monthlyN) || monthlyN < 0) found.monthly = "Monto inválido."
    if (deadline && !isValidISODate(deadline)) found.deadline = "Fecha inválida."
    setErrors(found)
    if (Object.keys(found).length) return

    financeActions.saveGoal(
      { name, icon, color, targetAmount: targetN, monthlyContribution: monthlyN, deadline: deadline || null },
      goal?.id
    )
    toast.success(goal ? "Meta actualizada" : "Meta creada", { description: name.trim() })
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      <div className="flex items-end gap-3">
        <IconChip icon={icon} color={color} size="lg" />
        <Field label="Nombre" error={errors.name} className="flex-1">
          {(p) => (
            <Input {...p} autoFocus maxLength={40} placeholder="Ej.: Viaje" value={name} onChange={(e) => setName(e.target.value)} />
          )}
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Monto objetivo" error={errors.target}>
          {(p) => <MoneyInput {...p} value={target} onValueChange={setTarget} />}
        </Field>
        <Field label="Aporte mensual" error={errors.monthly}>
          {(p) => <MoneyInput {...p} value={monthly} onValueChange={setMonthly} />}
        </Field>
      </div>

      <Field
        label="Fecha límite (opcional)"
        error={errors.deadline}
        hint={
          sim?.completion ? (
            <span className="inline-flex items-center gap-1">
              <CalendarCheck className="size-3.5" aria-hidden="true" />
              Con este aporte la alcanzás en {formatMonthLabel(sim.completion).toLowerCase()}.
            </span>
          ) : sim ? (
            "Definí un aporte mensual para estimar cuándo la alcanzás."
          ) : undefined
        }
      >
        {(p) => <Input {...p} type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />}
      </Field>

      <div className="grid gap-1.5">
        <Label>Ícono</Label>
        <IconPicker value={icon} color={color} onValueChange={setIcon} />
      </div>
      <div className="grid gap-1.5">
        <Label>Color</Label>
        <ColorPicker value={color} onValueChange={setColor} />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit">{goal ? "Guardar cambios" : "Crear meta"}</Button>
      </DialogFooter>
    </form>
  )
}

/* ============================================================================
 * Abonar / retirar fondos
 * ========================================================================= */

export type FundsMode = "deposit" | "withdraw"

interface GoalFundsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  formKey: number
  progress: GoalProgress | null
  mode: FundsMode
}

export function GoalFundsDialog({ open, onOpenChange, formKey, progress, mode }: GoalFundsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === "deposit" ? "Abonar a la meta" : "Retirar de la meta"}</DialogTitle>
          <DialogDescription>{progress?.goal.name}</DialogDescription>
        </DialogHeader>
        {progress && (
          <FundsForm key={formKey} progress={progress} mode={mode} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function FundsForm({ progress, mode, onDone }: { progress: GoalProgress; mode: FundsMode; onDone: () => void }) {
  const { goal, saved, remaining } = progress
  const suggestions =
    mode === "deposit"
      ? [
          goal.monthlyContribution > 0 && { label: "Aporte del mes", value: Math.min(goal.monthlyContribution, remaining) },
          remaining > 0 && { label: "Completar meta", value: remaining },
        ]
      : [saved > 0 && { label: "Todo", value: saved }]

  const [amount, setAmount] = useState(() => {
    const first = suggestions.find(Boolean)
    return first ? String(first.value) : ""
  })
  const [error, setError] = useState<string>()

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const n = parseAmount(amount)
    if (!Number.isFinite(n) || n <= 0) return setError("Ingresá un monto mayor a 0.")
    if (mode === "withdraw" && n > saved) return setError(`Solo hay ${formatMoney(saved)} ahorrados.`)

    financeActions.moveGoalFunds(goal.id, mode === "deposit" ? n : -n)
    const completes = mode === "deposit" && n >= remaining && remaining > 0
    toast.success(completes ? `¡Completaste “${goal.name}”! 🎉` : mode === "deposit" ? "Abono registrado" : "Retiro registrado", {
      description: `${mode === "deposit" ? "+" : "−"} ${formatMoney(n)}`,
    })
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Ahorrado</p>
          <p className="font-medium tabular-nums">{formatMoney(saved)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Falta</p>
          <p className="font-medium tabular-nums">{formatMoney(remaining)}</p>
        </div>
      </div>

      <Field label="Monto" error={error}>
        {(p) => <MoneyInput {...p} autoFocus value={amount} onValueChange={setAmount} />}
      </Field>

      <div className="flex flex-wrap gap-2">
        {suggestions.filter(Boolean).map((s) =>
          s ? (
            <Button key={s.label} type="button" size="xs" variant="secondary" onClick={() => setAmount(String(s.value))}>
              {s.label} · {formatMoney(s.value)}
            </Button>
          ) : null
        )}
      </div>

      {mode === "withdraw" && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <TriangleAlert className="mt-px size-3.5 shrink-0 text-warn-ink" aria-hidden="true" />
          Retirar fondos atrasa la meta. Usalo solo si realmente lo necesitás.
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" variant={mode === "withdraw" ? "destructive" : "default"}>
          {mode === "deposit" ? "Abonar" : "Retirar"}
        </Button>
      </DialogFooter>
    </form>
  )
}

/* ============================================================================
 * Simulador: ¿cuánto aportar por mes y cuándo llego?
 * ========================================================================= */

interface GoalSimulatorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  formKey: number
  progress: GoalProgress | null
}

export function GoalSimulatorDialog({ open, onOpenChange, formKey, progress }: GoalSimulatorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Simulador de aporte</DialogTitle>
          <DialogDescription>Mové el aporte mensual y mirá cuándo alcanzás “{progress?.goal.name}”.</DialogDescription>
        </DialogHeader>
        {progress && <Simulator key={formKey} progress={progress} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function Simulator({ progress, onDone }: { progress: GoalProgress; onDone: () => void }) {
  const { goal, remaining, requiredMonthly } = progress
  const step = remaining > 1_000_000 ? 5_000 : 1_000
  const max = Math.max(step, Math.ceil(Math.max(remaining / 3, (requiredMonthly ?? 0) * 2, goal.monthlyContribution * 2) / step) * step)
  const [monthly, setMonthly] = useState(Math.min(goal.monthlyContribution, max))

  const sim = simulateGoal(remaining, monthly)
  const deadlineMonth = goal.deadline ? monthKeyOf(goal.deadline) : null
  const late = deadlineMonth && sim.completion ? sim.completion > deadlineMonth : false

  function apply() {
    financeActions.saveGoal({ ...goal, monthlyContribution: monthly }, goal.id)
    toast.success("Aporte mensual actualizado", {
      description: `${goal.name}: ${formatMoney(monthly)} por mes`,
    })
    onDone()
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-3">
        <div className="flex items-baseline justify-between">
          <Label>Aporte mensual</Label>
          <span className="text-2xl font-semibold tabular-nums">{formatMoney(monthly)}</span>
        </div>
        <Slider
          value={[monthly]}
          min={0}
          max={max}
          step={step}
          onValueChange={([v]) => setMonthly(v)}
          aria-label="Aporte mensual"
        />
        {requiredMonthly !== null && (
          <Button
            type="button"
            variant="link"
            size="xs"
            className="justify-self-start px-0"
            onClick={() => setMonthly(Math.ceil(requiredMonthly / step) * step)}
          >
            Usar lo necesario para llegar a tiempo ({formatMoney(requiredMonthly)}/mes)
          </Button>
        )}
      </div>

      <div className={cn("grid gap-1 rounded-lg p-3 text-sm", late ? "bg-warn/15" : "bg-good/10")}>
        {sim.completion ? (
          <>
            <p className={cn("font-medium", late ? "text-warn-ink" : "text-good-ink")}>
              {late ? "Llegás tarde" : "Llegás a tiempo"}: {formatMonthLabel(sim.completion).toLowerCase()}
            </p>
            <p className="text-muted-foreground">
              {sim.months} {sim.months === 1 ? "mes" : "meses"} de aportes para juntar {formatMoney(remaining)}.
              {deadlineMonth && ` Fecha límite: ${formatMonthLabel(deadlineMonth).toLowerCase()}.`}
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">Sin aporte mensual la meta no avanza.</p>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cerrar
        </Button>
        <Button type="button" onClick={apply} disabled={monthly === goal.monthlyContribution}>
          Aplicar al plan
        </Button>
      </DialogFooter>
    </div>
  )
}
