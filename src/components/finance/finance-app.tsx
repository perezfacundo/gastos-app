"use client"

import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  House,
  Moon,
  Plus,
  SlidersHorizontal,
  Sun,
  Target,
  Wallet,
} from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { InstallHint } from "@/components/pwa/install-hint"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useFinanceMeta, useFinanceState } from "@/hooks/use-finance"
import { currentMonthKey, dateInMonth, formatMonthLabel, shiftMonth, todayISO } from "@/lib/finance/format"
import { financeActions } from "@/lib/finance/actions"
import { hasUserData } from "@/lib/finance/legacy"
import { financeStore } from "@/lib/finance/store"
import type { FinanceState, MonthKey, Transaction } from "@/lib/finance/types"
import { readPref, writePref } from "@/lib/preferences"

import { AccountMenu } from "./account-menu"
import { GoalsView } from "./goals/goals-view"
import { OnboardingWizard } from "./onboarding/onboarding-wizard"
import { HomeView } from "./home/home-view"
import { PlanView } from "./planning/plan-view"
import { useDialogState } from "./shared/misc"
import { SyncIndicator } from "./sync-indicator"
import { TransactionFormDialog } from "./transactions/transaction-form-dialog"
import { TransactionsView } from "./transactions/transactions-view"
import { LegacyImportBanner } from "./welcome-panel"

/**
 * Navegación por módulos: "Movimientos" (registro) y "Plan" (presupuesto) funcionan
 * solos; "Inicio" combina lo que la persona usa.
 */
const TABS = [
  { value: "home", label: "Inicio", icon: House },
  { value: "transactions", label: "Movimientos", icon: ArrowLeftRight },
  { value: "plan", label: "Plan", icon: SlidersHorizontal },
  { value: "goals", label: "Metas", icon: Target },
] as const

export type TabValue = (typeof TABS)[number]["value"]

export interface AppUser {
  id: string
  email: string
}

/**
 * App de un usuario logueado: carga sus datos desde Supabase y muestra la UI.
 * Las fechas ("hoy", mes actual) solo se calculan en el cliente, dentro de
 * <PlannerApp />, que se monta cuando el estado ya está cargado.
 */
export function FinanceApp({ user }: { user: AppUser }) {
  const state = useFinanceState()
  const meta = useFinanceMeta()

  // Cargar los datos del usuario (y recargarlos si cambia de cuenta).
  useEffect(() => {
    void financeStore.load(user.id)
  }, [user.id])

  // Errores de guardado → toast. El store recarga solo el estado del servidor.
  useEffect(() => {
    financeStore.setErrorHandler((message) =>
      toast.error("No se pudo guardar el cambio", {
        description: `${message}. Se restauraron los datos del servidor.`,
      })
    )
    return () => financeStore.setErrorHandler(null)
  }, [])

  if (meta.status === "error") {
    return (
      <AppFrame user={user}>
        <LoadError message={meta.error} onRetry={() => void financeStore.load(user.id, { force: true })} />
      </AppFrame>
    )
  }
  if (!state) {
    return (
      <AppFrame user={user}>
        <AppSkeleton />
      </AppFrame>
    )
  }
  return <PlannerApp state={state} user={user} />
}

/** App ya cargada: selector de mes, pestañas y diálogo global de movimientos. */
function PlannerApp({ state, user }: { state: FinanceState; user: AppUser }) {
  const [month, setMonth] = useState<MonthKey>(currentMonthKey)
  const [tab, setTab] = useState<TabValue>("home")
  // Acceso directo del ícono instalado ("/?nuevo=1"): abre directo el formulario.
  const txDialog = useDialogState<Transaction>(() => new URLSearchParams(window.location.search).has("nuevo"))
  const openNewTransaction = txDialog.openWith

  // Limpia "?nuevo=1" de la URL para que recargar no vuelva a abrir el diálogo.
  useEffect(() => {
    if (window.location.search.includes("nuevo")) window.history.replaceState(null, "", "/")
  }, [])

  // Fecha sugerida para un movimiento nuevo: hoy si se mira el mes actual.
  const defaultDate = month === currentMonthKey() ? todayISO() : dateInMonth(month, 1)

  // Atajo de teclado: "n" abre "Nuevo movimiento" (si no se está escribiendo en un campo).
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target instanceof Element ? event.target : null
      const typing = target?.closest("input, textarea, select, [contenteditable=true], [role=dialog]")
      if (event.key === "n" && !event.metaKey && !event.ctrlKey && !event.altKey && !typing) {
        event.preventDefault()
        openNewTransaction(null)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [openNewTransaction])

  // Fijos automáticos: se registran solos cuando vence su fecha. Se espera a tener
  // datos frescos del servidor (no solo la copia local) para no recrear algo que
  // el usuario borró desde otro dispositivo.
  const { legacy, synced } = useFinanceMeta()
  useEffect(() => {
    if (!synced) return
    const registered = financeActions.autoRegisterDue(state)
    if (registered > 0) {
      toast(`Registramos ${registered === 1 ? "1 fijo automático" : `${registered} fijos automáticos`} de este mes`, {
        description: "Si alguno no se cobró, podés borrarlo o editarlo en Movimientos.",
      })
    }
  }, [state, synced])

  // Asistente: se ofrece en cuentas nuevas y se puede abrir después para armar el plan.
  const skipKey = `onboarding-skipped:${user.id}`
  const [wizard, setWizard] = useState<"new" | "plan" | null>(() =>
    !hasUserData(state) && !legacy && !readPref(skipKey, false) ? "new" : null
  )

  if (wizard) {
    return (
      <AppFrame user={user}>
        <OnboardingWizard
          state={state}
          mode={wizard}
          onClose={() => {
            if (wizard === "new") writePref(skipKey, true)
            setWizard(null)
          }}
          onChooseTracking={() => txDialog.openWith(null)}
        />
      </AppFrame>
    )
  }

  async function loadSample() {
    try {
      await financeActions.resetToSample()
      toast.success("Datos de ejemplo cargados", { description: "Podés borrarlos desde el menú de tu cuenta." })
    } catch {
      /* el store ya avisó */
    }
  }

  return (
    <AppFrame
      user={user}
      monthSwitcher={<MonthSwitcher month={month} onChange={setMonth} />}
      onAddTransaction={() => txDialog.openWith(null)}
    >
      <InstallHint enabled={state.transactions.length >= 3} />
      <LegacyImportBanner />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)} className="gap-6">
        <TabsList className="w-full sm:w-fit" aria-label="Secciones">
          {TABS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="flex-1 sm:flex-none">
              <Icon aria-hidden="true" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sr-only sm:hidden">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="home">
          <HomeView
            state={state}
            month={month}
            onGoToPlan={() => setTab("plan")}
            onSeeAllTransactions={() => setTab("transactions")}
            onAddTransaction={() => txDialog.openWith(null)}
            onEditTransaction={(tx) => txDialog.openWith(tx)}
            onOpenWizard={() => setWizard("plan")}
            onLoadSample={loadSample}
          />
        </TabsContent>
        <TabsContent value="transactions">
          <TransactionsView
            state={state}
            month={month}
            onAdd={() => txDialog.openWith(null)}
            onEdit={(tx) => txDialog.openWith(tx)}
          />
        </TabsContent>
        <TabsContent value="plan">
          <PlanView state={state} month={month} onOpenWizard={() => setWizard("plan")} />
        </TabsContent>
        <TabsContent value="goals">
          <GoalsView state={state} />
        </TabsContent>
      </Tabs>

      <TransactionFormDialog
        open={txDialog.open}
        onOpenChange={txDialog.setOpen}
        formKey={txDialog.key}
        state={state}
        defaultDate={defaultDate}
        transaction={txDialog.item}
      />

      {/* Botón flotante en el celular: cargar un gasto está siempre a un toque. */}
      <Button
        size="icon-lg"
        className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 size-14 rounded-full shadow-lg sm:hidden [&_svg:not([class*='size-'])]:size-6"
        aria-label="Nuevo movimiento"
        onClick={() => txDialog.openWith(null)}
      >
        <Plus />
      </Button>
    </AppFrame>
  )
}

/** Marco común (encabezado + contenedor). `user` es opcional para el esqueleto previo al login. */
export function AppFrame({
  children,
  user,
  monthSwitcher,
  onAddTransaction,
}: {
  children: React.ReactNode
  user?: AppUser
  monthSwitcher?: React.ReactNode
  onAddTransaction?: () => void
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground" aria-hidden="true">
              <Wallet className="size-5" />
            </span>
            <div className="leading-tight">
              <h1 className="text-base font-semibold">Plan Financiero</h1>
              <p className="hidden text-xs text-muted-foreground sm:block">Planificá antes de gastar</p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1.5 sm:order-3 sm:ml-0">
            {user && <SyncIndicator />}
            {onAddTransaction && (
              <Button size="sm" className="hidden sm:inline-flex" onClick={onAddTransaction}>
                <Plus data-icon="inline-start" />
                Movimiento
                <kbd className="ml-1 hidden rounded border border-primary-foreground/30 px-1 text-[10px] leading-4 opacity-70 lg:inline">N</kbd>
              </Button>
            )}
            <ThemeToggle />
            {user && <AccountMenu user={user} />}
          </div>

          <div className="order-last w-full sm:order-2 sm:mx-auto sm:w-auto">{monthSwitcher}</div>
        </div>
      </header>

      {/* pb extra en el celular: el botón flotante no tapa el último contenido. */}
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 pt-6 pb-24 sm:pb-6">{children}</main>
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * Piezas del encabezado y estados
 * ------------------------------------------------------------------------- */

function MonthSwitcher({ month, onChange }: { month: MonthKey; onChange: (m: MonthKey) => void }) {
  const current = currentMonthKey()
  return (
    <div className="flex items-center justify-between gap-1 sm:justify-center">
      <Button size="icon-sm" variant="ghost" aria-label="Mes anterior" onClick={() => onChange(shiftMonth(month, -1))}>
        <ChevronLeft />
      </Button>
      <p className="min-w-36 text-center text-sm font-medium" aria-live="polite">
        {formatMonthLabel(month)}
      </p>
      <Button size="icon-sm" variant="ghost" aria-label="Mes siguiente" onClick={() => onChange(shiftMonth(month, 1))}>
        <ChevronRight />
      </Button>
      {month !== current && (
        <Button size="xs" variant="outline" onClick={() => onChange(current)}>
          Hoy
        </Button>
      )}
    </div>
  )
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label="Cambiar tema claro/oscuro"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {/* Ambos íconos se alternan por CSS: evita desajustes de hidratación. */}
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
    </Button>
  )
}

function LoadError({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border bg-card px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <CloudOff className="size-6" aria-hidden="true" />
      </span>
      <p className="font-medium">No pudimos cargar tus datos</p>
      <p className="text-sm text-muted-foreground">
        Revisá tu conexión e intentá de nuevo.
        {message && <span className="mt-1 block text-xs">Detalle: {message}</span>}
      </p>
      <Button onClick={onRetry}>Reintentar</Button>
    </div>
  )
}

export function AppSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <Skeleton className="h-9 w-96 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <Skeleton className="h-64 lg:col-span-3" />
        <Skeleton className="h-64 lg:col-span-2" />
      </div>
    </div>
  )
}
