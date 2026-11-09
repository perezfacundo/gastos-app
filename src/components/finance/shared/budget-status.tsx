import { CircleCheck, CircleDashed, OctagonAlert, TriangleAlert, type LucideIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { formatMoney } from "@/lib/finance/format"
import type { BudgetStatus } from "@/lib/finance/types"
import { cn } from "@/lib/utils"

interface StatusMeta {
  label: string
  icon: LucideIcon
  /** Clase de relleno (barras). */
  fill: string
  /** Clase de texto legible sobre la tarjeta. */
  ink: string
  /** Fondo tenue para badges. */
  soft: string
}

/**
 * Semántica de alertas de presupuesto. El color NUNCA va solo: siempre
 * acompañado de ícono y texto (accesible para daltonismo).
 */
export const STATUS_META: Record<BudgetStatus, StatusMeta> = {
  ok: { label: "En camino", icon: CircleCheck, fill: "bg-good", ink: "text-good-ink", soft: "bg-good/10" },
  warning: { label: "Cerca del límite", icon: TriangleAlert, fill: "bg-warn", ink: "text-warn-ink", soft: "bg-warn/15" },
  over: { label: "Excedido", icon: OctagonAlert, fill: "bg-bad", ink: "text-bad-ink", soft: "bg-bad/10" },
  unbudgeted: {
    label: "Sin límite",
    icon: CircleDashed,
    fill: "bg-muted-foreground/40",
    ink: "text-muted-foreground",
    soft: "bg-muted",
  },
}

export function StatusBadge({ status, label, className }: { status: BudgetStatus; label?: string; className?: string }) {
  const meta = STATUS_META[status]
  const Icon = meta.icon
  return (
    <Badge variant="outline" className={cn("gap-1 border-transparent", meta.soft, meta.ink, className)}>
      <Icon aria-hidden="true" />
      {label ?? meta.label}
    </Badge>
  )
}

interface BudgetBarProps {
  spent: number
  pending: number
  limit: number
  status: BudgetStatus
  className?: string
  label?: string
}

/**
 * Barra de presupuesto de dos segmentos: gasto real (sólido) + fijos por pagar
 * (rayado). Si se excede, la escala se extiende y una marca indica el límite.
 *
 * Se implementa a medida (en lugar de <Progress/>) porque necesita dos
 * segmentos y un marcador; mantiene la semántica ARIA de progressbar.
 */
export function BudgetBar({ spent, pending, limit, status, className, label }: BudgetBarProps) {
  const projected = spent + pending
  const scale = Math.max(limit, projected, 1)
  const meta = STATUS_META[status]
  const spentPct = (spent / scale) * 100
  const pendingPct = (pending / scale) * 100
  const limitPct = limit > 0 && projected > limit ? (limit / scale) * 100 : null

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={limit > 0 ? 100 : undefined}
      aria-valuenow={limit > 0 ? Math.round((projected / limit) * 100) : undefined}
      aria-valuetext={
        limit > 0
          ? `${formatMoney(projected)} de ${formatMoney(limit)} (${meta.label})`
          : `${formatMoney(projected)} sin límite`
      }
      className={cn("relative flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-muted", className)}
    >
      {spentPct > 0 && (
        <div className={cn("h-full rounded-full transition-all", meta.fill)} style={{ width: `${spentPct}%` }} />
      )}
      {pendingPct > 0 && (
        <div
          className={cn("bar-pending h-full rounded-full opacity-70 transition-all", meta.ink)}
          style={{ width: `${pendingPct}%` }}
        />
      )}
      {limitPct !== null && (
        <div
          aria-hidden="true"
          className="absolute inset-y-0 w-0.5 bg-foreground"
          style={{ left: `calc(${limitPct}% - 1px)` }}
        />
      )}
    </div>
  )
}
