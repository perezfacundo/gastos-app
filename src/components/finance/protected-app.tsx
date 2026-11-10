"use client"

import { AuthGate } from "@/components/auth/auth-gate"

import { AppFrame, AppSkeleton, FinanceApp } from "./finance-app"

/**
 * Página principal protegida. Vive en un Client Component porque AuthGate
 * recibe una función como children (no serializable desde un Server Component).
 */
export function ProtectedApp() {
  return (
    <AuthGate
      fallback={
        <AppFrame>
          <AppSkeleton />
        </AppFrame>
      }
    >
      {(session) => <FinanceApp user={{ id: session.user.id, email: session.user.email ?? "" }} />}
    </AuthGate>
  )
}
