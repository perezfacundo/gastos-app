import type { MetadataRoute } from "next"

/** Manifiesto PWA: permite instalar la app en el celular (ícono en la pantalla de inicio). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Plan Financiero",
    short_name: "Plan",
    description: "Planificá tu dinero antes de gastarlo.",
    lang: "es-AR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#171717",
    theme_color: "#171717",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Mantener apretado el ícono (Android) → acceso directo a cargar un gasto.
    shortcuts: [
      {
        name: "Nuevo movimiento",
        short_name: "Nuevo",
        url: "/?nuevo=1",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  }
}
