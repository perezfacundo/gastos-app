"use client"

import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Database,
  Eraser,
  LayoutDashboard,
  Moon,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Sun,
  Target,
  Wallet,
} from "lucide-react"
import { useTheme } from "next-themes"
import { useState } from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useFinanceState } from "@/hooks/use-finance"
import { financeActions } from "@/lib/finance/actions"
import { currentMonthKey, dateInMonth, formatMonthLabel, shiftMonth, todayISO } from "@/lib/finance/format"
import type { FinanceState, MonthKey } from "@/lib/finance/types"

import { BudgetsView } from "./budgets/budgets-view"
import { GoalsView } from "./goals/goals-view"
import { PlanningView } from "./planning/planning-view"
import { useDialogState } from "./shared/misc"
import { TransactionFormDialog } from "./transactions/transaction-form-dialog"
import { TransactionsView } from "./transactions/transactions-view"

const TABS = [
  { value: "plan", label: "Planificación", icon: LayoutDashboard },
  { value: "budgets", label: "Límites", icon: SlidersHorizontal },
  { value: "goals", label: "Metas", icon: Target },
  { value: "transactions", label: "Movimientos", icon: ArrowLeftRight },
] as const

type TabValue = (typeof TABS)[number]["value"]

/**
 * Punto de entrada. En el servidor (y durante la hidratación) no hay
 * localStorage: se muestra el esqueleto. Las fechas ("hoy", mes actual) solo
 * se calculan en el cliente, dentro de <PlannerApp />.
 */
export function FinanceApp() {
  const state = useFinanceState()
  if (!state) {
    return (
      <AppFrame>
        <AppSkeleton />
      </AppFrame>
    )
  }
  return <PlannerApp state={state} />
}

/** App ya cargada: selector de mes, pestañas y diálogo global de movimientos. */
function PlannerApp({ state }: { state: FinanceState }) {
  const [month, setMonth] = useState<MonthKey>(currentMonthKey)
  const [tab, setTab] = useState<TabValue>("plan")
  const txDialog = useDialogState<null>()

  // Fecha sugerida para un movimiento nuevo: hoy si se mira el mes actual.
  const defaultDate = month === currentMonthKey() ? todayISO() : dateInMonth(month, 1)

  return (
    <AppFrame
      monthSwitcher={<MonthSwitcher month={month} onChange={setMonth} />}
      onAddTransaction={() => txDialog.openWith(null)}
    >
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

        <TabsContent value="plan">
          <PlanningView state={state} month={month} onEditLimits={() => setTab("budgets")} />
        </TabsContent>
        <TabsContent value="budgets">
          <BudgetsView state={state} month={month} />
        </TabsContent>
        <TabsContent value="goals">
          <GoalsView state={state} />
        </TabsContent>
        <TabsContent value="transactions">
          <TransactionsView state={state} month={month} onAdd={() => txDialog.openWith(null)} />
        </TabsContent>
      </Tabs>

      <TransactionFormDialog
        open={txDialog.open}
        onOpenChange={txDialog.setOpen}
        formKey={txDialog.key}
        state={state}
        defaultDate={defaultDate}
      />
    </AppFrame>
  )
}

/** Marco común (encabezado + contenedor) para el esqueleto y la app cargada. */
function AppFrame({
  children,
  monthSwitcher,
  onAddTransaction,
}: {
  children: React.ReactNode
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
            <Button size="sm" onClick={onAddTransaction} disabled={!onAddTransaction}>
              <Plus data-icon="inline-start" />
              <span className="hidden sm:inline">Movimiento</span>
              <span className="sr-only sm:hidden">Nuevo movimiento</span>
            </Button>
            <ThemeToggle />
            <DataMenu />
          </div>

          <div className="order-last w-full sm:order-2 sm:mx-auto sm:w-auto">{monthSwitcher}</div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * Piezas del encabezado
 * ------------------------------------------------------------------------- */

function MonthSwitcher({ month, onChange }: { month: MonthKey; onChange: (m: MonthKey) => void }) {
  const current = currentMonthKey()
  return (
    <div>
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

function DataMenu() {
  const [confirm, setConfirm] = useState<"sample" | "clear" | null>(null)

  const copy = {
    sample: {
      title: "¿Restaurar datos de ejemplo?",
      description: "Se reemplazarán todos tus datos por el ejemplo inicial.",
      action: "Restaurar",
      run: () => {
        financeActions.resetToSample()
        toast.success("Datos de ejemplo restaurados")
      },
    },
    clear: {
      title: "¿Empezar de cero?",
      description: "Se borrarán movimientos, fijos y metas. Las categorías se conservan sin límites.",
      action: "Borrar todo",
      run: () => {
        financeActions.clearAll()
        toast.success("Listo: empezás con un plan en blanco")
      },
    },
  } as const

  const current = confirm ? copy[confirm] : null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" aria-label="Opciones de datos">
            <Database />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Datos (guardados en este navegador)</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setConfirm("sample")}>
            <RotateCcw /> Restaurar datos de ejemplo
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirm("clear")}>
            <Eraser /> Empezar de cero
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{current?.title}</AlertDialogTitle>
            <AlertDialogDescription>{current?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant={confirm === "clear" ? "destructive" : "default"}
              onClick={() => {
                current?.run()
                setConfirm(null)
              }}
            >
              {current?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function AppSkeleton() {
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
