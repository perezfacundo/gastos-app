"use client"

import { TrendingDown, TrendingUp } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { formatMoney, formatMonthLabel, formatPercent } from "@/lib/finance/format"
import type { SpendingSummary } from "@/lib/finance/insights"
import type { Category, MonthKey } from "@/lib/finance/types"
import { cn } from "@/lib/utils"

import { IconChip } from "../shared/category-icon"

/**
 * Número principal para quien solo anota gastos (sin plan):
 * cuánto gastó en el mes y cómo viene contra el mes pasado.
 */
export function TrackingHero({
  summary,
  month,
  isCurrent,
  topCategory,
}: {
  summary: SpendingSummary
  month: MonthKey
  isCurrent: boolean
  topCategory?: Category
}) {
  const monthName = formatMonthLabel(month).split(" ")[0].toLowerCase()
  const { change } = summary
  const more = change !== null && change > 0.02
  const less = change !== null && change < -0.02

  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-3 px-5">
        <p className="text-sm text-muted-foreground">{isCurrent ? "Este mes llevás gastado" : `En ${monthName} gastaste`}</p>
        <p className="text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">{formatMoney(summary.total)}</p>
        <p className="text-sm text-muted-foreground">
          {formatMoney(summary.dailyAverage)} por día en promedio · {summary.count}{" "}
          {summary.count === 1 ? "movimiento" : "movimientos"}
        </p>

        {change !== null ? (
          <p
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs",
              more && "bg-warn/15 text-warn-ink",
              less && "bg-good/10 text-good-ink",
              !more && !less && "bg-muted text-muted-foreground"
            )}
          >
            {more ? <TrendingUp className="size-3.5" aria-hidden="true" /> : <TrendingDown className="size-3.5" aria-hidden="true" />}
            {more || less
              ? `${formatPercent(Math.abs(change))} ${more ? "más" : "menos"} que el mes pasado${isCurrent ? " a esta altura" : ""}`
              : `Parecido al mes pasado${isCurrent ? " a esta altura" : ""}`}
          </p>
        ) : (
          <p className="rounded-md bg-muted px-2 py-1.5 text-xs text-muted-foreground">
            El mes que viene vas a poder compararte con este.
          </p>
        )}

        {topCategory && (
          <p className="mt-auto flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
            <IconChip icon={topCategory.icon} color={topCategory.color} size="sm" className="size-5 rounded" />
            Donde más gastás: <strong className="text-foreground">{topCategory.name}</strong>
          </p>
        )}
      </CardContent>
    </Card>
  )
}
