"use client"

import { ArrowLeft, ArrowRight, Check, PartyPopper, Receipt, SlidersHorizontal, Sparkles, TriangleAlert } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { financeActions } from "@/lib/finance/actions"
import { monthPlan, spendingPace } from "@/lib/finance/calculations"
import { currentMonthKey, formatMoney } from "@/lib/finance/format"
import {
  buildOnboardingState,
  FIXED_PRESETS,
  suggestLimits,
  suggestSavings,
  type FixedInput,
} from "@/lib/finance/onboarding"
import type { FinanceState } from "@/lib/finance/types"
import { cn } from "@/lib/utils"

import { ChoiceCard } from "../home/home-view"
import { IconChip } from "../shared/category-icon"
import { MoneyInput, parseAmount } from "../shared/form-fields"

const STEPS = ["Ingreso", "Gastos fijos", "Límites", "Listo"] as const

/** Convierte el texto de un input en número ≥ 0 (vacío o inválido = 0). */
const toAmount = (raw: string) => {
  const n = parseAmount(raw)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * Configuración inicial en 4 pasos (≈2 minutos). Termina mostrando el número
 * que el usuario va a mirar todos los días: cuánto puede gastar por día.
 */
interface OnboardingWizardProps {
  state: FinanceState
  /**
   * "new": cuenta nueva → primero se elige por dónde empezar.
   * "plan": alguien que ya usa la app (ej. solo anotaba gastos) arma su plan; no se borra nada.
   */
  mode: "new" | "plan"
  onClose: () => void
  /** Eligió "Anotar mis gastos": se cierra el asistente y se abre la carga rápida. */
  onChooseTracking?: () => void
}

export function OnboardingWizard({ state, mode, onClose, onChooseTracking }: OnboardingWizardProps) {
  // -1 = elegir por dónde empezar (solo en cuentas nuevas).
  const [step, setStep] = useState(mode === "new" ? -1 : 0)
  const [income, setIncome] = useState("")
  const [incomeDay, setIncomeDay] = useState("1")
  /** Fijos elegidos: clave del preset → monto (texto del input). */
  const [fixed, setFixed] = useState<Record<string, string>>({})
  const [savings, setSavings] = useState<string | null>(null) // null = usar la sugerencia
  const [limitEdits, setLimitEdits] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const incomeN = toAmount(income)
  const fixedInputs: FixedInput[] = FIXED_PRESETS.filter((p) => p.key in fixed).map((p) => ({
    description: p.label,
    categoryId: p.categoryId,
    amount: toAmount(fixed[p.key]),
    day: p.day,
  }))
  const fixedTotal = fixedInputs.reduce((s, f) => s + f.amount, 0)
  const savingsN = savings === null ? suggestSavings(Math.max(0, incomeN - fixedTotal)) : toAmount(savings)

  const suggested = useMemo(
    () => suggestLimits(state.categories, incomeN, fixedInputs, savingsN),
    // fixedInputs se deriva de `fixed`: se recalcula cuando cambian sus montos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.categories, incomeN, fixed, savingsN]
  )
  const limits = Object.fromEntries(
    Object.entries(suggested).map(([id, value]) => [id, id in limitEdits ? toAmount(limitEdits[id]) : value])
  )

  const built = useMemo(
    () => buildOnboardingState(state, { income: incomeN, incomeDay: Number(incomeDay) || 1, fixed: fixedInputs, savings: savingsN, limits }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, incomeN, incomeDay, fixed, savingsN, limitEdits, suggested]
  )
  const preview = useMemo(() => {
    const plan = monthPlan(built, currentMonthKey())
    return { plan, pace: spendingPace(built, plan) }
  }, [built])

  const assigned = Object.values(limits).reduce((s, n) => s + n, 0) + savingsN
  const unassigned = incomeN - assigned
  const canContinue = step !== 0 || incomeN > 0

  /** Suma el plan SIN borrar nada (quien venía anotando gastos conserva su historial). */
  function finish() {
    financeActions.applyPlan(built, state)
    toast.success("¡Tu plan está listo!", {
      description: "Los fijos se registran solos en su fecha. Podés cambiarlo en Plan.",
    })
    onClose()
  }

  async function loadSample() {
    setBusy(true)
    try {
      await financeActions.resetToSample()
      toast.success("Datos de ejemplo cargados", { description: "Podés borrarlos desde el menú de tu cuenta." })
    } catch {
      /* el store ya avisó */
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mx-auto w-full max-w-xl">
      <CardHeader>
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{step >= 0 && `Paso ${step + 1} de ${STEPS.length} · ${STEPS[step]}`}</span>
          <button type="button" className="underline-offset-3 hover:text-foreground hover:underline" onClick={onClose}>
            {mode === "new" ? "Saltar por ahora" : "Cancelar"}
          </button>
        </div>
        {step >= 0 && (
          <Progress value={((step + 1) / STEPS.length) * 100} className="mb-3 h-1.5" aria-label="Progreso de la configuración" />
        )}

        {step === -1 && (
          <>
            <CardTitle className="text-xl">¿Por dónde querés empezar?</CardTitle>
            <CardDescription>Podés usar una sola parte o las dos: se complementan, y sumás la otra cuando quieras.</CardDescription>
          </>
        )}

        {step === 0 && (
          <>
            <CardTitle className="text-xl">Armemos tu plan en 2 minutos</CardTitle>
            <CardDescription>¿Cuánto cobrás por mes? Si varía, poné un promedio tirando para abajo.</CardDescription>
          </>
        )}
        {step === 1 && (
          <>
            <CardTitle className="text-xl">¿Qué gastos fijos tenés?</CardTitle>
            <CardDescription>Tocá los que pagás todos los meses y poné cuánto, aproximadamente.</CardDescription>
          </>
        )}
        {step === 2 && (
          <>
            <CardTitle className="text-xl">Tus límites sugeridos</CardTitle>
            <CardDescription>Primero separamos tu ahorro; el resto lo repartimos. Cambiá lo que quieras.</CardDescription>
          </>
        )}
        {step === 3 && (
          <>
            <CardTitle className="flex items-center gap-2 text-xl">
              <PartyPopper className="size-5" aria-hidden="true" /> Tu plan está listo
            </CardTitle>
            <CardDescription>Esto es lo que vas a ver cada vez que abras la app.</CardDescription>
          </>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ---------------------------- Elegir el camino ---------------------------- */}
        {step === -1 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <ChoiceCard
              icon={Receipt}
              title="Anotar mis gastos"
              text="Registrá lo que gastás y mirá en qué se va tu plata. Sin configurar nada."
              cta="Anotar mi primer gasto"
              onClick={() => {
                onClose()
                onChooseTracking?.()
              }}
            />
            <ChoiceCard
              icon={SlidersHorizontal}
              title="Armar mi presupuesto"
              text="Ingreso, fijos y límites: sabé cuánto podés gastar por día."
              cta="Empezar (2 min)"
              onClick={() => setStep(0)}
            />
          </div>
        )}

        {/* ------------------------------- Paso 1 ------------------------------- */}
        {step === 0 && (
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="ob-income">Ingreso mensual</Label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-2xl text-muted-foreground">$</span>
                <Input
                  id="ob-income"
                  autoFocus
                  type="number"
                  inputMode="decimal"
                  min={0}
                  placeholder="0"
                  value={income}
                  onChange={(e) => setIncome(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && incomeN > 0 && setStep(1)}
                  className="h-14 pl-8 text-3xl font-semibold tabular-nums md:text-3xl"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ob-day">¿Qué día del mes cobrás?</Label>
              <Input
                id="ob-day"
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                className="w-24"
                value={incomeDay}
                onChange={(e) => setIncomeDay(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* ------------------------------- Paso 2 ------------------------------- */}
        {step === 1 && (
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Gastos fijos típicos">
              {FIXED_PRESETS.map((p) => {
                const selected = p.key in fixed
                return (
                  <Button
                    key={p.key}
                    type="button"
                    size="sm"
                    variant={selected ? "default" : "outline"}
                    aria-pressed={selected}
                    onClick={() =>
                      setFixed((prev) => {
                        const next = { ...prev }
                        if (selected) delete next[p.key]
                        else next[p.key] = ""
                        return next
                      })
                    }
                  >
                    {selected && <Check data-icon="inline-start" />}
                    {p.label}
                  </Button>
                )
              })}
            </div>
            {fixedInputs.length > 0 && (
              <ul className="grid gap-2">
                {FIXED_PRESETS.filter((p) => p.key in fixed).map((p, i) => {
                  const category = state.categories.find((c) => c.id === p.categoryId)
                  return (
                    <li key={p.key} className="flex items-center gap-3">
                      {category && <IconChip icon={category.icon} color={category.color} size="sm" />}
                      <Label htmlFor={`ob-fixed-${p.key}`} className="flex-1">
                        {p.label}
                      </Label>
                      <div className="w-40">
                        <MoneyInput
                          id={`ob-fixed-${p.key}`}
                          autoFocus={i === fixedInputs.length - 1}
                          value={fixed[p.key]}
                          onValueChange={(v) => setFixed((prev) => ({ ...prev, [p.key]: v }))}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">
              Total fijos: <strong className="text-foreground">{formatMoney(fixedTotal)}</strong>. Podés agregar otros después.
            </p>
          </div>
        )}

        {/* ------------------------------- Paso 3 ------------------------------- */}
        {step === 2 && (
          <div className="grid gap-4">
            <div className="grid gap-1.5 rounded-lg bg-muted p-3">
              <Label htmlFor="ob-savings">Ahorro mensual (fondo de emergencia)</Label>
              <div className="w-48">
                <MoneyInput id="ob-savings" value={savings ?? String(savingsN)} onValueChange={setSavings} />
              </div>
              <p className="text-xs text-muted-foreground">
                Sugerido: 10% de lo que te queda después de los fijos. Poné 0 si este mes no podés.
              </p>
            </div>

            <ul className="grid gap-2">
              {state.categories
                .filter((c) => c.kind === "expense")
                .map((c) => (
                  <li key={c.id} className="flex items-center gap-3">
                    <IconChip icon={c.icon} color={c.color} size="sm" />
                    <Label htmlFor={`ob-limit-${c.id}`} className="flex-1">
                      {c.name}
                    </Label>
                    <div className="w-40">
                      <MoneyInput
                        id={`ob-limit-${c.id}`}
                        value={c.id in limitEdits ? limitEdits[c.id] : String(suggested[c.id] ?? 0)}
                        onValueChange={(v) => setLimitEdits((prev) => ({ ...prev, [c.id]: v }))}
                      />
                    </div>
                  </li>
                ))}
            </ul>

            <p
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm",
                unassigned < 0 ? "bg-bad/10 text-bad-ink" : "bg-good/10 text-good-ink"
              )}
            >
              {unassigned < 0 ? (
                <>
                  <TriangleAlert className="size-4" aria-hidden="true" />
                  Te estás pasando {formatMoney(-unassigned)} de tu ingreso.
                </>
              ) : (
                <>
                  <Check className="size-4" aria-hidden="true" />
                  {unassigned > 0 ? `Te quedan ${formatMoney(unassigned)} sin destino.` : "Cada peso tiene un destino."}
                </>
              )}
            </p>
          </div>
        )}

        {/* ------------------------------- Paso 4 ------------------------------- */}
        {step === 3 && (
          <div className="grid gap-4">
            <div className="rounded-xl border p-5 text-center">
              {preview.pace.status === "over" ? (
                <p className="text-bad-ink">Con estos números tus gastos superan tu ingreso. Revisá los límites.</p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">Este mes podés gastar</p>
                  <p className="text-4xl font-semibold tracking-tight tabular-nums">{formatMoney(preview.pace.perDay)}</p>
                  <p className="text-sm text-muted-foreground">por día, sin tocar tu ahorro</p>
                </>
              )}
            </div>
            <ul className="grid gap-1.5 text-sm text-muted-foreground">
              <li>
                <strong className="text-foreground">Fijos automáticos:</strong> se registran solos en su fecha, no tenés que hacer
                nada.
              </li>
              <li>
                <strong className="text-foreground">Si querés más precisión:</strong> anotá tus gastos con{" "}
                <strong className="text-foreground">+</strong> y el número diario se ajusta a lo que gastás de verdad.
              </li>
            </ul>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex-wrap gap-2">
        {step > (mode === "new" ? -1 : 0) && (
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={busy}>
            <ArrowLeft data-icon="inline-start" /> Atrás
          </Button>
        )}
        {step === -1 && (
          <Button variant="ghost" onClick={loadSample} disabled={busy}>
            <Sparkles data-icon="inline-start" /> Ver un ejemplo
          </Button>
        )}
        <div className="ml-auto">
          {step === -1 ? null : step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canContinue}>
              {step === 1 && fixedInputs.length === 0 ? "No tengo fijos" : "Siguiente"} <ArrowRight data-icon="inline-end" />
            </Button>
          ) : (
            <Button onClick={finish} disabled={busy}>
              {busy ? "Guardando…" : "Empezar a usarla"}
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}
