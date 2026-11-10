"use client"

import { useMemo } from "react"

import { useCategoryMap, useMonthPlan } from "@/hooks/use-finance"
import { usageProfile } from "@/lib/finance/insights"
import type { FinanceState, MonthKey } from "@/lib/finance/types"
import { cn } from "@/lib/utils"

import { BudgetsView } from "../budgets/budgets-view"
import { IncomeSetupCard } from "../home/income-setup-card"
import { CashFlowCard } from "./cash-flow-card"
import { RecurringCard } from "./recurring-card"

/**
 * Pestaña "Plan": ingreso, a dónde va, fijos y límites.
 * Funciona sin anotar gastos (los fijos automáticos se registran solos) y,
 * si se anotan, los límites muestran el gasto real.
 */
export function PlanView({ state, month, onOpenWizard }: { state: FinanceState; month: MonthKey; onOpenWizard: () => void }) {
  const plan = useMonthPlan(state, month)
  const categoryMap = useCategoryMap(state)
  const profile = useMemo(() => usageProfile(state, month), [state, month])

  return (
    <div className="space-y-6">
      {!profile.hasIncome && <IncomeSetupCard state={state} onOpenWizard={onOpenWizard} variant="plan" />}

      <div className="grid gap-6 lg:grid-cols-5">
        {profile.hasIncome && (
          <div className="lg:col-span-3">
            <CashFlowCard plan={plan} />
          </div>
        )}
        <div className={cn(profile.hasIncome ? "lg:col-span-2" : "lg:col-span-5")}>
          <RecurringCard state={state} plan={plan} categoryMap={categoryMap} />
        </div>
      </div>

      <BudgetsView state={state} month={month} />
    </div>
  )
}
