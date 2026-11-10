"use client"

import { Calculator, Wand2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { financeActions } from "@/lib/finance/actions"
import { formatMoney } from "@/lib/finance/format"
import type { FinanceState } from "@/lib/finance/types"

import { MoneyInput, parseAmount } from "../shared/form-fields"

/**
 * La puerta de entrada al plan para quien solo anota gastos: con UN dato (el
 * ingreso) ya puede ver "cuánto puede gastar por día", usando sus gastos reales.
 */
export function IncomeSetupCard({
  state,
  onOpenWizard,
  variant = "home",
}: {
  state: FinanceState
  onOpenWizard: () => void
  variant?: "home" | "plan"
}) {
  const [amount, setAmount] = useState("")
  const [day, setDay] = useState("1")
  const [error, setError] = useState<string>()

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const n = parseAmount(amount)
    if (!Number.isFinite(n) || n <= 0) return setError("Ingresá un monto mayor a 0.")
    financeActions.setupIncome(state, n, Number(day) || 1)
    toast.success("¡Listo!", { description: `Con ${formatMoney(n)} por mes ya calculamos cuánto podés gastar por día.` })
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="size-4" aria-hidden="true" />
          {variant === "home" ? "¿Cuánto podés gastar por día?" : "Empezá por tu ingreso"}
        </CardTitle>
        <CardDescription>
          {variant === "home"
            ? "Cargá cuánto cobrás y te lo calculamos con tus gastos reales. Lleva 10 segundos."
            : "Con tu ingreso mensual calculamos cuánto podés gastar, cómo se reparte y cuánto ahorrar."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={handleSubmit} noValidate className="flex flex-wrap items-end gap-2">
          <div className="grid min-w-40 flex-1 gap-1.5">
            <Label htmlFor={`income-${variant}`}>Ingreso mensual</Label>
            <MoneyInput id={`income-${variant}`} value={amount} onValueChange={setAmount} aria-invalid={error ? true : undefined} />
          </div>
          <div className="grid w-24 gap-1.5">
            <Label htmlFor={`income-day-${variant}`}>Día de cobro</Label>
            <Input
              id={`income-day-${variant}`}
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </div>
          <Button type="submit">Calcular</Button>
        </form>
        {error && <p className="text-xs text-bad-ink">{error}</p>}
        <Button variant="link" size="sm" className="px-0" onClick={onOpenWizard}>
          <Wand2 data-icon="inline-start" />
          O armá el plan completo: ingreso, fijos y límites (2 min)
        </Button>
      </CardContent>
    </Card>
  )
}
