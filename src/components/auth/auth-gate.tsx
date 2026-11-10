"use client"

import type { Session } from "@supabase/supabase-js"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { useAuth } from "@/hooks/use-auth"

import { AuthShell } from "./auth-shell"

interface AuthGateProps {
  /** Se renderiza solo con sesión activa. */
  children: (session: Session) => React.ReactNode
  /** Qué mostrar mientras se restaura la sesión. */
  fallback: React.ReactNode
}

/**
 * Protege una pantalla: sin sesión, redirige a /login.
 *
 * OJO: esto es solo experiencia de usuario. La seguridad de los datos la
 * garantiza RLS en la base: aunque alguien saltee este componente, la API no
 * le devuelve datos que no sean suyos.
 */
export function AuthGate({ children, fallback }: AuthGateProps) {
  const auth = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (auth.status === "signed-out") router.replace("/login")
  }, [auth.status, router])

  if (auth.status === "unconfigured") return <SetupNotice />
  if (auth.status === "signed-in" && auth.session) return children(auth.session)
  return fallback
}

/** Ayuda para quien clona el repo y todavía no configuró las variables de entorno. */
function SetupNotice() {
  return (
    <AuthShell>
      <div className="space-y-3 rounded-xl border bg-card p-5 text-sm">
        <p className="font-medium">Falta configurar Supabase</p>
        <p className="text-muted-foreground">
          Copiá <code className="rounded bg-muted px-1">.env.example</code> a{" "}
          <code className="rounded bg-muted px-1">.env.local</code>, completá la URL y la publishable key de tu proyecto y
          reiniciá <code className="rounded bg-muted px-1">npm run dev</code>. Los pasos completos están en{" "}
          <code className="rounded bg-muted px-1">docs/DEPLOY.md</code>.
        </p>
      </div>
    </AuthShell>
  )
}
