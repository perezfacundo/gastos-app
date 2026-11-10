"use client"

import { CloudCheck, CloudOff, Loader2 } from "lucide-react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useFinanceMeta } from "@/hooks/use-finance"
import { cn } from "@/lib/utils"

/**
 * Estado de sincronización, siempre visible:
 *  - "Sin conexión · N pendientes": los cambios están a salvo en el dispositivo.
 *  - "Guardando…": hay cambios viajando al servidor.
 *  - "Guardado": todo está en la nube.
 */
export function SyncIndicator() {
  const { status, queued, offline } = useFinanceMeta()
  if (status !== "ready") return null

  const state = offline ? "offline" : queued > 0 ? "saving" : "saved"
  const Icon = { offline: CloudOff, saving: Loader2, saved: CloudCheck }[state]
  const label = {
    offline: queued > 0 ? `Sin conexión · ${queued} ${queued === 1 ? "cambio pendiente" : "cambios pendientes"}` : "Sin conexión",
    saving: "Guardando…",
    saved: "Guardado",
  }[state]
  const help = {
    offline: "Tus cambios están guardados en este dispositivo y se sincronizan solos al volver la conexión.",
    saving: "Enviando tus cambios a la nube.",
    saved: "Todo está guardado en la nube.",
  }[state]

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="status"
          aria-live="polite"
          tabIndex={0}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            state === "offline" ? "bg-warn/15 text-warn-ink" : "text-muted-foreground"
          )}
        >
          <Icon className={cn("size-3.5", state === "saving" && "animate-spin")} aria-hidden="true" />
          {/* En el celular solo el ícono, salvo sin conexión (importa que se vea). */}
          <span className={cn(state === "offline" ? "inline" : "hidden md:inline")}>{label}</span>
          <span className="sr-only md:hidden">{state !== "offline" && label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-60">{help}</TooltipContent>
    </Tooltip>
  )
}
