"use client"

import { ArrowDownLeft, ArrowUpRight, OctagonAlert, PiggyBank, TriangleAlert, Wallet } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useCategoryMap, useMonthPlan } from "@/hooks/use-finance"
import type { MonthPlan } from "@/lib/finance/calculations"
import { formatMoney } from "@/lib/finance/format"
import type { FinanceState, MonthKey } from "@/lib/finance/types"
import { cn } from "@/lib/utils"

import { StatCard } from "../shared/misc"
import { BudgetOverview } from "./budget-overview"
import { CashFlowCard } from "./cash-flow-card"
import { RecurringCard } from "./recurring-card"

interface PlanningViewProps {
  state: FinanceState
  month: MonthKey
  onEditLimits: () => void
}

/** Vista principal: ingresos vs. lo asignado, saldo libre y presupuestos. */
export function PlanningView({ state, month, onEditLimits }: PlanningViewProps) {
  const plan = useMonthPlan(state, month)
  const categoryMap = useCategoryMap(state)
  const free = plan.freeBalance

  return (
    <div className="space-y-6">
      <PlanAlerts plan={plan} />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Resumen del plan">
        <StatCard
          label="Ingresos previstos"
          icon={ArrowDownLeft}
          value={formatMoney(plan.income.expected)}
          hint={`${formatMoney(plan.income.actual)} cobrados · ${formatMoney(plan.income.pending)} por cobrar`}
        />
        <StatCard
          label="Gastos proyectados"
          icon={ArrowUpRight}
          value={formatMoney(plan.expenses.projected)}
          hint={`${formatMoney(plan.expenses.actual)} reales + ${formatMoney(plan.expenses.pendingFixed)} fijos`}
        />
        <StatCard
          label="Ahorro planificado"
          icon={PiggyBank}
          value={formatMoney(plan.savings.reserved)}
          hint={`${formatMoney(plan.savings.deposited)} ya abonado a metas`}
        />
        <StatCard
          label="Saldo libre"
          icon={Wallet}
          value={formatMoney(free)}
          valueClassName={cn(free > 0 && "text-good-ink", free < 0 && "text-bad-ink")}
          className={cn(free < 0 && "ring-bad/40")}
          hint={
            free >= 0
              ? `Para gastar sin tocar tu ahorro · ${formatMoney(plan.budgets.remainingBudget)} ya presupuestado`
              : "Tus gastos proyectados superan lo que ingresa"
          }
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <CashFlowCard plan={plan} />
        </div>
        <div className="lg:col-span-2">
          <RecurringCard state={state} plan={plan} categoryMap={categoryMap} />
        </div>
      </div>

      <BudgetOverview rows={plan.budgets.rows} onEditLimits={onEditLimits} />
    </div>
  )
}

/** Alertas accionables (color + ícono + texto, nunca solo color). */
function PlanAlerts({ plan }: { plan: MonthPlan }) {
  const over = plan.budgets.rows.filter((r) => r.status === "over")
  const warning = plan.budgets.rows.filter((r) => r.status === "warning")
  const overdue = plan.recurring.filter((o) => o.status === "overdue")
  const alerts: { tone: "bad" | "warn"; title: string; description: string }[] = []

  if (plan.unassigned < 0) {
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
            <AlertDescription>{a.description}</AlertDescription>
          </Alert>
        )
      })}
    </div>
  )
}
