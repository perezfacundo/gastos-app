"use client"

import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { byDateDesc } from "@/lib/finance/calculations"
import { formatDate, formatMoneyPrecise } from "@/lib/finance/format"
import type { Category, Transaction } from "@/lib/finance/types"
import { cn } from "@/lib/utils"

import { IconChip } from "../shared/category-icon"

/** Últimos movimientos: confirma de un vistazo que lo cargado quedó bien. */
export function RecentTransactions({
  transactions,
  categoryMap,
  onEdit,
  onSeeAll,
}: {
  transactions: Transaction[]
  categoryMap: Map<string, Category>
  onEdit: (tx: Transaction) => void
  onSeeAll: () => void
}) {
  const recent = [...transactions].sort(byDateDesc).slice(0, 5)
  if (!recent.length) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Últimos movimientos</CardTitle>
        <CardAction>
          <Button variant="ghost" size="sm" onClick={onSeeAll}>
            Ver todos <ArrowRight data-icon="inline-end" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="-mx-2 divide-y">
          {recent.map((t) => {
            const category = categoryMap.get(t.categoryId)
            const income = t.type === "income"
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onEdit(t)}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {category && <IconChip icon={category.icon} color={category.color} size="sm" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{t.description}</span>
                    <span className="block text-xs text-muted-foreground">{formatDate(t.date)}</span>
                  </span>
                  <span className={cn("text-sm font-semibold tabular-nums whitespace-nowrap", income && "text-good-ink")}>
                    {income ? "+" : "−"} {formatMoneyPrecise(t.amount)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
