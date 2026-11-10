"use client"

import { CircleCheck, Info, OctagonAlert, Plus, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { MonthPlan, SpendingPace } from "@/lib/finance/calculations"
import { daysInMonth, formatDate, formatMoney, formatMonthLabel } from "@/lib/finance/format"
import { cn } from "@/lib/utils"

/**
 * El número que responde la pregunta de todos los días:
 * "¿cuánto puedo gastar hoy sin romper mi plan?"
 */
export function SpendingHero({
  pace,
  plan,
  tracksSpending,
  onAddTransaction,
}: {
  pace: SpendingPace
  plan: MonthPlan
  /** ¿El usuario anota sus gastos? Si no, el número es su presupuesto diario y se lo invita a anotar. */
  tracksSpending: boolean
  onAddTransaction: () => void
}) {
  const monthName = formatMonthLabel(plan.month).split(" ")[0].toLowerCase()
  const lastDay = `${plan.month}-${String(daysInMonth(plan.month)).padStart(2, "0")}`

  return (
    <Card className={cn("h-full", pace.status === "over" && "ring-bad/40")}>
      <CardContent className="flex h-full flex-col gap-3 px-5">
        {pace.timing === "past" ? (
          <PastSummary pace={pace} monthName={monthName} />
        ) : pace.status === "over" ? (
          <>
            <p className="flex items-center gap-1.5 text-sm font-medium text-bad-ink">
              <OctagonAlert className="size-4" aria-hidden="true" />
              Te pasaste del plan de {monthName}
            </p>
            <p className="text-4xl font-semibold tracking-tight text-bad-ink tabular-nums">{formatMoney(-pace.available)}</p>
            <p className="text-sm text-muted-foreground">
              Tus gastos previstos superan lo que ingresa. Frená los gastos variables o bajá por este mes el aporte a tus metas.
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {pace.timing === "current" ? "Podés gastar" : `En ${monthName} vas a poder gastar`}
              </p>
              <HowItWorks />
            </div>
            <p className="flex items-baseline gap-2">
              <span className="text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">{formatMoney(pace.perDay)}</span>
              <span className="text-base text-muted-foreground">por día</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {pace.timing === "current"
                ? `hasta el ${formatDate(lastDay, { day: "numeric", month: "long" })} · ${pace.daysLeft === 1 ? "último día" : `quedan ${pace.daysLeft} días`}`
                : `durante ${pace.daysLeft} días`}
            </p>

            {pace.timing === "current" &&
              (tracksSpending ? (
                <TodayProgress pace={pace} />
              ) : (
                // Complemento: el plan funciona solo, pero con gastos reales el número es exacto.
                <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                  <span className="flex-1">Anotá tus gastos y este número se ajusta a lo que gastás de verdad.</span>
                  <Button size="xs" variant="outline" onClick={onAddTransaction}>
                    <Plus data-icon="inline-start" /> Anotar un gasto
                  </Button>
                </div>
              ))}
          </>
        )}

        <p className="mt-auto border-t pt-3 text-xs text-muted-foreground">
          Libre en el mes: <strong className="text-foreground tabular-nums">{formatMoney(pace.available)}</strong> · ya descontados
          fijos y ahorro
        </p>
      </CardContent>
    </Card>
  )
}

function TodayProgress({ pace }: { pace: SpendingPace }) {
  const ratio = pace.perDay > 0 ? (pace.spentToday / pace.perDay) * 100 : pace.spentToday > 0 ? 100 : 0
  const tight = pace.status === "tight"
  const Icon = tight ? TriangleAlert : CircleCheck

  return (
    <div className="space-y-1.5">
      <Progress
        value={ratio}
        className="h-2"
        indicatorClassName={tight ? "bg-warn" : "bg-good"}
        aria-label="Gastado hoy respecto del monto diario"
      />
      <p className={cn("flex items-center gap-1 text-xs", tight ? "text-warn-ink" : "text-muted-foreground")}>
        <Icon className="size-3.5" aria-hidden="true" />
        {pace.spentToday === 0
          ? "Hoy todavía no registraste gastos."
          : tight
            ? `Hoy gastaste ${formatMoney(pace.spentToday)}: ${formatMoney(-pace.leftToday)} más que tu diario. Mañana se reacomoda.`
            : `Hoy gastaste ${formatMoney(pace.spentToday)} · te quedan ${formatMoney(pace.leftToday)}`}
      </p>
    </div>
  )
}

function PastSummary({ pace, monthName }: { pace: SpendingPace; monthName: string }) {
  const over = pace.status === "over"
  return (
    <>
      <p className="text-sm text-muted-foreground">Cerraste {monthName} con</p>
      <p className={cn("text-4xl font-semibold tracking-tight tabular-nums", over ? "text-bad-ink" : "text-good-ink")}>
        {formatMoney(Math.abs(pace.available))}
      </p>
      <p className="text-sm text-muted-foreground">{over ? "por encima de tu plan." : "libres después de gastos y ahorro."}</p>
    </>
  )
}

function HowItWorks() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="grid size-6 place-items-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label="Cómo se calcula"
        >
          <Info className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        Lo que te queda del mes después de tus gastos, los fijos que faltan pagar y el ahorro para tus metas, dividido por los
        días que quedan. Se recalcula cada día.
      </TooltipContent>
    </Tooltip>
  )
}
