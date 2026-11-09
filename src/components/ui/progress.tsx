"use client"

import * as React from "react"
import { cn } from "cn"
import { Progress as ProgressPrimitive } from "radix-ui"

/**
 * shadcn/ui Progress, extendido con `indicatorClassName` / `indicatorStyle`
 * para colorear la barra según estado (presupuesto) o identidad (meta).
 */
function Progress({
  className,
  value,
  indicatorClassName,
  indicatorStyle,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  indicatorClassName?: string
  indicatorStyle?: React.CSSProperties
}) {
  const clamped = Math.min(100, Math.max(0, value || 0))
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={clamped}
      className={cn(
        "relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-muted",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn("size-full flex-1 rounded-full bg-primary transition-all", indicatorClassName)}
        style={{ transform: `translateX(-${100 - clamped}%)`, ...indicatorStyle }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
