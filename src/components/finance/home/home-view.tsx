"use client"

import { ArrowDownLeft, ArrowUpRight, OctagonAlert, PiggyBank, Receipt, SlidersHorizontal, Sparkles, TriangleAlert } from "lucide-react"
import { useMemo } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useCategoryMap, useMonthPlan } from "@/hooks/use-finance"
import { spendingPace, transactionsInMonth, type MonthPlan } from "@/lib/finance/calculations"
import { currentMonthKey, formatMoney } from "@/lib/finance/format"
import { spendingSummary, usageProfile } from "@/lib/finance/insights"
import type { FinanceState, MonthKey, Transaction } from "@/lib/finance/types"
import { cn } from "@/lib/utils"

import { SpendingHero } from "../planning/spending-hero"
import { StatCard } from "../shared/misc"
import { CategoryBreakdown } from "./category-breakdown"
import { IncomeSetupCard } from "./income-setup-card"
import { RecentTransactions } from "./recent-transactions"
import { TrackingHero } from "./tracking-hero"

interface HomeViewProps {
  state: FinanceState
  month: MonthKey
  onGoToPlan: () => void
  onSeeAllTransactions: () => void
  onAddTransaction: () => void
  onEditTransaction: (tx: Transaction) => void
  onOpenWizard: () => void
  onLoadSample: () => void
}

/**
 * Inicio adaptable: se arma según lo que la persona usa.
 *  - Con ingreso (plan)         → "Podés gastar $X por día".
 *  - Solo anota gastos          → "Este mes llevás gastado $X" + invitación a cargar el ingreso.
 *  - Cada módulo suma contexto al otro (límites en las barras, gastos reales en el diario).
 */
export function HomeView(props: HomeViewProps) {
  const { state, month, onGoToPlan, onAddTransaction } = props
  const plan = useMonthPlan(state, month)
  const categoryMap = useCategoryMap(state)
  const profile = useMemo(() => usageProfile(state, month), [state, month])
  const pace = useMemo(() => spendingPace(state, plan), [state, plan])
  const summary = useMemo(() => spendingSummary(state, month), [state, month])
  const monthTx = useMemo(() => transactionsInMonth(state, month), [state, month])
  const isCurrent = month === currentMonthKey()

  if (!profile.plans && !profile.tracksSpending && monthTx.length === 0) {
    return <EmptyHome {...props} />
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-5" aria-label="Resumen del mes">
        <div className="lg:col-span-2">
          {profile.hasIncome ? (
            <SpendingHero pace={pace} plan={plan} tracksSpending={profile.tracksSpending} onAddTransaction={onAddTransaction} />
          ) : (
            <TrackingHero
              summary={summary}
              month={month}
              isCurrent={isCurrent}
              topCategory={summary.topCategoryId ? categoryMap.get(summary.topCategoryId) : undefined}
            />
          )}
        </div>
        <div className="lg:col-span-3">
          {profile.hasIncome ? (
            <div className="grid h-full gap-4 sm:grid-cols-3">
              <StatCard
                label="Ingresos del mes"
                icon={ArrowDownLeft}
                value={formatMoney(plan.income.expected)}
                hint={
                  plan.income.pending > 0
                    ? `${formatMoney(plan.income.actual)} cobrados · ${formatMoney(plan.income.pending)} por cobrar`
                    : "Todo cobrado"
                }
              />
              <StatCard
                label={profile.tracksSpending ? "Gastado este mes" : "Gastos previstos"}
                icon={ArrowUpRight}
                value={formatMoney(profile.tracksSpending ? summary.total : plan.expenses.projected)}
                hint={
                  profile.tracksSpending
                    ? summary.change !== null
                      ? `${formatMoney(summary.dailyAverage)}/día · ${summary.change > 0 ? "+" : ""}${Math.round(summary.change * 100)}% vs. mes pasado`
                      : `${formatMoney(summary.dailyAverage)} por día en promedio`
                    : `${formatMoney(plan.expenses.pendingFixed)} de fijos por pagar`
                }
              />
              <StatCard
                label="Para tus metas"
                icon={PiggyBank}
                value={formatMoney(plan.savings.reserved)}
                hint={`${formatMoney(plan.savings.deposited)} ya separado este mes`}
              />
            </div>
          ) : (
            <IncomeSetupCard state={state} onOpenWizard={props.onOpenWizard} />
          )}
        </div>
      </section>

      <PlanAlerts plan={plan} onGoToPlan={onGoToPlan} />

      <div className={cn("grid gap-6", monthTx.length > 0 && "lg:grid-cols-5")}>
        <div className={cn(monthTx.length > 0 && "lg:col-span-3")}>
          <CategoryBreakdown rows={plan.budgets.rows} onEditLimits={onGoToPlan} onAddTransaction={onAddTransaction} />
        </div>
        {monthTx.length > 0 && (
          <div className="lg:col-span-2">
            <RecentTransactions
              transactions={monthTx}
              categoryMap={categoryMap}
              onEdit={props.onEditTransaction}
              onSeeAll={props.onSeeAllTransactions}
            />
          </div>
        )}
      </div>
    </div>
  )
}

/** Cuenta sin datos: dos puertas de entrada equivalentes (ninguna obligatoria). */
function EmptyHome({ onAddTransaction, onOpenWizard, onLoadSample }: HomeViewProps) {
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle className="text-xl">¿Por dónde querés empezar?</CardTitle>
        <CardDescription>Podés usar una sola de estas partes o las dos: se complementan.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            icon={Receipt}
            title="Anotar mis gastos"
            text="Registrá lo que gastás y mirá en qué se va tu plata. Sin configurar nada."
            cta="Anotar mi primer gasto"
            onClick={onAddTransaction}
          />
          <ChoiceCard
            icon={SlidersHorizontal}
            title="Armar mi presupuesto"
            text="Ingreso, fijos y límites: sabé cuánto podés gastar por día."
            cta="Armar el plan (2 min)"
            onClick={onOpenWizard}
          />
        </div>
        <Button variant="ghost" size="sm" onClick={onLoadSample}>
          <Sparkles data-icon="inline-start" /> O explorá con datos de ejemplo
        </Button>
      </CardContent>
    </Card>
  )
}

export function ChoiceCard({
  icon: Icon,
  title,
  text,
  cta,
  onClick,
}: {
  icon: typeof Receipt
  title: string
  text: string
  cta: string
  onClick: () => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      <span className="grid size-10 place-items-center rounded-lg bg-muted">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="flex-1 space-y-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
      <Button onClick={onClick}>{cta}</Button>
    </div>
  )
}

/** Alertas accionables (color + ícono + texto, nunca solo color). */
function PlanAlerts({ plan, onGoToPlan }: { plan: MonthPlan; onGoToPlan: () => void }) {
  const over = plan.budgets.rows.filter((r) => r.status === "over")
  const warning = plan.budgets.rows.filter((r) => r.status === "warning")
  const overdue = plan.recurring.filter((o) => o.status === "overdue")
  const alerts: { tone: "bad" | "warn"; title: string; description: string; action?: string }[] = []

  // Sin ingreso cargado no hay plan que "superar": quien solo anota gastos no ve esta alerta.
  if (plan.income.expected > 0 && plan.unassigned < 0) {
    alerts.push({
      tone: "bad",
      title: `Tu plan supera los ingresos por ${formatMoney(-plan.unassigned)}`,
      description: "Bajá algún límite o el aporte a metas para que el plan cierre.",
    })
  }
  if (over.length) {
    alerts.push({
      tone: "bad",
      title: `${over.length === 1 ? "1 categoría excedida" : `${over.length} categorías excedidas`}`,
      description: over.map((r) => `${r.category.name} (+${formatMoney(-r.remaining)})`).join(" · "),
    })
  }
  if (warning.length) {
    alerts.push({
      tone: "warn",
      title: `${warning.length === 1 ? "1 categoría cerca del límite" : `${warning.length} categorías cerca del límite`}`,
      description: warning.map((r) => `${r.category.name}: quedan ${formatMoney(r.remaining)}`).join(" · "),
    })
  }
  if (overdue.length) {
    alerts.push({
      tone: "warn",
      title: `${overdue.length === 1 ? "1 fijo vencido" : `${overdue.length} fijos vencidos`} sin registrar`,
      description: overdue.map((o) => o.item.description).join(" · "),
      action: "Registrarlos",
    })
  }

  if (!alerts.length) return null

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {alerts.map((a) => {
        const Icon = a.tone === "bad" ? OctagonAlert : TriangleAlert
        return (
          <Alert key={a.title} className={cn(a.tone === "bad" ? "border-bad/40" : "border-warn/50")}>
            <Icon className={a.tone === "bad" ? "text-bad-ink" : "text-warn-ink"} />
            <AlertTitle>{a.title}</AlertTitle>
            <AlertDescription>
              {a.description}
              {a.action && (
                <Button size="xs" variant="outline" className="mt-2" onClick={onGoToPlan}>
                  {a.action}
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )
      })}
    </div>
  )
}
