"use client"

import type { LucideIcon } from "lucide-react"
import { useCallback, useState } from "react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/* ----------------------------------------------------------------------------
 * Tarjeta de indicador (KPI)
 * ------------------------------------------------------------------------- */

interface StatCardProps {
  label: string
  value: string
  icon: LucideIcon
  hint?: React.ReactNode
  /** Clase de color para el valor (p. ej. text-good-ink). */
  valueClassName?: string
  className?: string
}

export function StatCard({ label, value, icon: Icon, hint, valueClassName, className }: StatCardProps) {
  return (
    <Card className={cn("gap-2 py-4", className)}>
      <CardContent className="space-y-1.5 px-4">
        <div className="flex items-center justify-between gap-2 text-muted-foreground">
          <p className="text-sm">{label}</p>
          <Icon className="size-4" aria-hidden="true" />
        </div>
        <p className={cn("truncate text-2xl font-semibold tracking-tight", valueClassName)}>{value}</p>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  )
}

/* ----------------------------------------------------------------------------
 * Estado vacío
 * ------------------------------------------------------------------------- */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center", className)}>
      <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * Estado de diálogos "crear / editar"
 * ------------------------------------------------------------------------- */

/**
 * Maneja apertura + ítem en edición + `key` para reiniciar el formulario en
 * cada apertura (sin vaciar el contenido durante la animación de cierre).
 */
export function useDialogState<T>() {
  const [state, setState] = useState<{ open: boolean; item: T | null; key: number }>({
    open: false,
    item: null,
    key: 0,
  })

  const openWith = useCallback((item: T | null = null) => {
    setState((s) => ({ open: true, item, key: s.key + 1 }))
  }, [])

  const setOpen = useCallback((open: boolean) => {
    setState((s) => ({ ...s, open }))
  }, [])

  return { ...state, openWith, setOpen }
}
