"use client"

import { HardDriveUpload } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useFinanceMeta } from "@/hooks/use-finance"
import { financeStore } from "@/lib/finance/store"

/**
 * Si en este navegador hay datos de la versión anterior (sin cuentas), ofrece
 * pasarlos a la cuenta. (La bienvenida de cuentas vacías vive en Inicio.)
 */
export function LegacyImportBanner() {
  const { legacy } = useFinanceMeta()
  const [busy, setBusy] = useState(false)
  if (!legacy) return null

  const count = legacy.transactions.length
  return (
    <Alert>
      <HardDriveUpload />
      <AlertTitle>Encontramos datos guardados en este navegador</AlertTitle>
      <AlertDescription>
        <p>
          Son de la versión anterior, sin cuenta ({count} {count === 1 ? "movimiento" : "movimientos"}, {legacy.goals.length} metas).
          ¿Querés pasarlos a tu cuenta para tenerlos en todos tus dispositivos?
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await financeStore.importLegacy()
                toast.success("Datos importados a tu cuenta")
              } catch {
                // El error ya se mostró (toast del store); los datos locales se conservan.
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? "Importando…" : "Importar a mi cuenta"}
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => financeStore.dismissLegacy()}>
            No, descartarlos
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
