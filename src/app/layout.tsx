import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Plan Financiero",
  description: "Planificá tu dinero antes de gastarlo: presupuestos, metas de ahorro y flujo previsto.",
  applicationName: "Plan Financiero",
  // iOS: al agregarla a la pantalla de inicio se abre como app (sin barra del navegador).
  appleWebApp: { capable: true, title: "Plan", statusBarStyle: "default" },
}

export const viewport: Viewport = {
  // Color de la barra del navegador / sistema, según el tema del dispositivo.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#171717" },
  ],
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: next-themes agrega la clase del tema antes de hidratar.
    <html lang="es" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-muted/40">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster position="bottom-right" richColors={false} closeButton />
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  )
}
