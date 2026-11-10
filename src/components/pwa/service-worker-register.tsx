"use client"

import { useEffect } from "react"

/**
 * Registra el service worker (solo en producción: en desarrollo una caché
 * agresiva hace que no veas tus cambios).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        // Le pasamos al SW los archivos que esta página ya cargó, para que la
        // app abra sin conexión desde la primera visita.
        const urls = [
          window.location.pathname,
          ...performance
            .getEntriesByType("resource")
            .map((entry) => entry.name)
            .filter((name) => name.startsWith(window.location.origin)),
        ]
        registration.active?.postMessage({ type: "CACHE_URLS", urls })
      })
      .catch((error) => console.warn("[sw] No se pudo registrar:", error))
  }, [])

  return null
}
