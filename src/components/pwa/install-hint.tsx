"use client"

import { Share, Smartphone, X } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { readPref, writePref } from "@/lib/preferences"

/** Evento no estándar (Chrome/Android) que permite mostrar el diálogo nativo de instalación. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

const DISMISS_KEY = "install-hint-dismissed"

/**
 * Sugerencia para instalar la app en el celular: tener el ícono en la pantalla de
 * inicio es el disparador más simple para volver todos los días.
 * Se muestra solo en dispositivos táctiles, si no está instalada, y cuando el
 * usuario ya usa la app (`enabled`). Se puede descartar para siempre.
 */
export function InstallHint({ enabled }: { enabled: boolean }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(() => readPref(DISMISS_KEY, false))
  // Este componente solo se monta en el cliente (con datos cargados): window existe.
  const [env] = useState(() => ({
    standalone:
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    touch: window.matchMedia("(pointer: coarse)").matches,
    ios: /iphone|ipad|ipod/i.test(navigator.userAgent),
  }))

  useEffect(() => {
    function onPrompt(event: Event) {
      event.preventDefault() // lo mostramos nosotros, en el momento oportuno
      setDeferred(event as BeforeInstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt", onPrompt)
    return () => window.removeEventListener("beforeinstallprompt", onPrompt)
  }, [])

  if (!enabled || dismissed || env.standalone || !env.touch || (!deferred && !env.ios)) return null

  function dismiss() {
    writePref(DISMISS_KEY, true)
    setDismissed(true)
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-4 text-sm">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
        <Smartphone className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="font-medium">Tené la app a mano</p>
        {deferred ? (
          <>
            <p className="text-muted-foreground">Instalala en tu inicio: cargás un gasto en dos toques, incluso sin señal.</p>
            <Button
              size="sm"
              onClick={async () => {
                await deferred.prompt()
                const { outcome } = await deferred.userChoice
                setDeferred(null)
                if (outcome === "accepted") dismiss()
              }}
            >
              Instalar
            </Button>
          </>
        ) : (
          <p className="text-muted-foreground">
            En Safari tocá <Share className="inline size-4 align-text-bottom" aria-label="Compartir" /> y después{" "}
            <strong className="text-foreground">“Agregar a inicio”</strong>. Vas a abrirla como una app, incluso sin señal.
          </p>
        )}
      </div>
      <Button size="icon-sm" variant="ghost" aria-label="No mostrar más" onClick={dismiss}>
        <X />
      </Button>
    </div>
  )
}
