"use client"

import {
  Calculator,
  CalendarDays,
  CircleCheck,
  Ellipsis,
  Minus,
  PiggyBank,
  Pencil,
  Plus,
  Target,
  Trash2,
  TriangleAlert,
  TrendingUp,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"
import { useGoalsProgress } from "@/hooks/use-finance"
import { financeActions } from "@/lib/finance/actions"
import type { GoalProgress } from "@/lib/finance/calculations"
import { colorVar } from "@/lib/finance/config"
import { formatDate, formatMoney, formatMonthLabel, formatPercent, monthKeyOf } from "@/lib/finance/format"
import type { FinanceState, SavingsGoal } from "@/lib/finance/types"
import { cn } from "@/lib/utils"

import { IconChip } from "../shared/category-icon"
import { EmptyState, StatCard, useDialogState } from "../shared/misc"
import { GoalFormDialog, GoalFundsDialog, GoalSimulatorDialog, type FundsMode } from "./goal-dialogs"

/** Simulador / planificador de metas de ahorro. */
export function GoalsView({ state }: { state: FinanceState }) {
  const progress = useGoalsProgress(state)
  const formDialog = useDialogState<SavingsGoal>()
  const fundsDialog = useDialogState<string>()
  const simDialog = useDialogState<string>()
  const [fundsMode, setFundsMode] = useState<FundsMode>("deposit")

  const byId = (id: string | null) => progress.find((p) => p.goal.id === id) ?? null
  const active = progress.filter((p) => !p.completed)
  const totalSaved = progress.reduce((s, p) => s + p.saved, 0)
  const totalTarget = progress.reduce((s, p) => s + p.goal.targetAmount, 0)
  const monthlyPlanned = active.reduce((s, p) => s + p.goal.monthlyContribution, 0)
  const onTrack = active.filter((p) => p.onTrack !== false).length

  function openFunds(goalId: string, mode: FundsMode) {
    setFundsMode(mode)
    fundsDialog.openWith(goalId)
  }

  function remove(goal: SavingsGoal) {
    const removed = financeActions.removeGoal(goal.id)
    if (!removed) return
    toast(`Se eliminó “${goal.name}”`, {
      action: { label: "Deshacer", onClick: () => financeActions.restoreGoal(removed) },
    })
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3" aria-label="Resumen de metas">
        <StatCard
          label="Total ahorrado"
          icon={PiggyBank}
          value={formatMoney(totalSaved)}
          hint={`${formatPercent(totalTarget ? totalSaved / totalTarget : 0)} de ${formatMoney(totalTarget)} en metas`}
        />
        <StatCard
          label="Aporte mensual planificado"
          icon={TrendingUp}
          value={formatMoney(monthlyPlanned)}
          hint="Se reserva en el plan de cada mes"
        />
        <StatCard
          label="Metas en camino"
          icon={Target}
          value={`${onTrack} de ${active.length}`}
          valueClassName={onTrack < active.length ? "text-warn-ink" : undefined}
          hint={onTrack < active.length ? "Hay metas que necesitan más aporte" : "Todas llegan a tiempo"}
        />
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {progress.map((p) => (
          <GoalCard
            key={p.goal.id}
            progress={p}
            onDeposit={() => openFunds(p.goal.id, "deposit")}
            onWithdraw={() => openFunds(p.goal.id, "withdraw")}
            onSimulate={() => simDialog.openWith(p.goal.id)}
            onEdit={() => formDialog.openWith(p.goal)}
            onRemove={() => remove(p.goal)}
          />
        ))}

        <button
          type="button"
          onClick={() => formDialog.openWith(null)}
          className="flex min-h-56 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted-foreground transition outline-none hover:border-foreground/30 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Plus className="size-5" aria-hidden="true" />
          Nueva meta
        </button>
      </div>

      {progress.length === 0 && (
        <EmptyState
          icon={Target}
          title="Todavía no tenés metas"
          description="Definí un objetivo (viaje, fondo de emergencia…) y un aporte mensual: lo reservamos en tu plan."
        />
      )}

      <GoalFormDialog
        open={formDialog.open}
        onOpenChange={formDialog.setOpen}
        formKey={formDialog.key}
        goal={formDialog.item}
        saved={byId(formDialog.item?.id ?? null)?.saved ?? 0}
      />
      <GoalFundsDialog
        open={fundsDialog.open}
        onOpenChange={fundsDialog.setOpen}
        formKey={fundsDialog.key}
        progress={byId(fundsDialog.item)}
        mode={fundsMode}
      />
      <GoalSimulatorDialog
        open={simDialog.open}
        onOpenChange={simDialog.setOpen}
        formKey={simDialog.key}
        progress={byId(simDialog.item)}
      />
    </div>
  )
}

interface GoalCardProps {
  progress: GoalProgress
  onDeposit: () => void
  onWithdraw: () => void
  onSimulate: () => void
  onEdit: () => void
  onRemove: () => void
}

function GoalCard({ progress, onDeposit, onWithdraw, onSimulate, onEdit, onRemove }: GoalCardProps) {
  const { goal, saved, ratio, completed, onTrack, requiredMonthly, projectedCompletion, contributedThisMonth } = progress

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <IconChip icon={goal.icon} color={goal.color} />
          <div className="min-w-0">
            <CardTitle className="truncate">{goal.name}</CardTitle>
            <CardDescription className="flex items-center gap-1">
              <CalendarDays className="size-3" aria-hidden="true" />
              {goal.deadline ? `Hasta ${formatDate(goal.deadline, { month: "short", year: "numeric" })}` : "Sin fecha límite"}
            </CardDescription>
          </div>
        </div>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-sm" variant="ghost" aria-label={`Acciones de ${goal.name}`}>
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onSimulate} disabled={completed}>
                <Calculator /> Simular aporte
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={onRemove}>
                <Trash2 /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-2xl font-semibold tabular-nums">{formatMoney(saved)}</p>
          <p className="text-sm text-muted-foreground tabular-nums">
            de {formatMoney(goal.targetAmount)} · {formatPercent(ratio)}
          </p>
        </div>
        <Progress
          value={ratio * 100}
          className="h-2.5"
          indicatorStyle={{ backgroundColor: colorVar(goal.color) }}
          aria-label={`Progreso de ${goal.name}`}
        />

        <GoalStatus
          completed={completed}
          onTrack={onTrack}
          requiredMonthly={requiredMonthly}
          monthly={goal.monthlyContribution}
          completion={projectedCompletion}
          deadlineMonth={goal.deadline ? monthKeyOf(goal.deadline) : null}
        />

        {!completed && goal.monthlyContribution > 0 && (
          <p className="text-xs text-muted-foreground tabular-nums">
            Este mes abonaste {formatMoney(Math.max(0, contributedThisMonth))} de {formatMoney(goal.monthlyContribution)} planificados
          </p>
        )}
      </CardContent>

      <CardFooter className="mt-auto gap-2">
        <Button size="sm" onClick={onDeposit} disabled={completed}>
          <Plus data-icon="inline-start" />
          Abonar
        </Button>
        <Button size="sm" variant="outline" onClick={onWithdraw} disabled={saved <= 0}>
          <Minus data-icon="inline-start" />
          Retirar
        </Button>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={onSimulate} disabled={completed}>
          <Calculator data-icon="inline-start" />
          Simular
        </Button>
      </CardFooter>
    </Card>
  )
}

function GoalStatus({
  completed,
  onTrack,
  requiredMonthly,
  monthly,
  completion,
  deadlineMonth,
}: {
  completed: boolean
  onTrack: boolean | null
  requiredMonthly: number | null
  monthly: number
  completion: string | null
  deadlineMonth: string | null
}) {
  let tone: "good" | "warn" | "muted" = "muted"
  let Icon = CalendarDays
  let text: string

  if (completed) {
    tone = "good"
    Icon = CircleCheck
    text = "¡Meta cumplida!"
  } else if (onTrack === false && requiredMonthly !== null) {
    tone = "warn"
    Icon = TriangleAlert
    text = `Atrasada: necesitás ${formatMoney(requiredMonthly)}/mes (planificás ${formatMoney(monthly)})`
  } else if (completion) {
    tone = deadlineMonth ? "good" : "muted"
    Icon = deadlineMonth ? CircleCheck : CalendarDays
    text = `${deadlineMonth ? "En camino: " : ""}la alcanzás en ${formatMonthLabel(completion).toLowerCase()}`
  } else {
    text = "Definí un aporte mensual para proyectar la fecha"
  }

  return (
    <p
      className={cn(
        "flex items-start gap-1.5 rounded-md px-2 py-1.5 text-xs",
        tone === "good" && "bg-good/10 text-good-ink",
        tone === "warn" && "bg-warn/15 text-warn-ink",
        tone === "muted" && "bg-muted text-muted-foreground"
      )}
    >
      <Icon className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      {text}
    </p>
  )
}
