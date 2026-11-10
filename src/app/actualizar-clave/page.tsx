import type { Metadata } from "next"

import { AuthShell } from "@/components/auth/auth-shell"
import { UpdatePasswordForm } from "@/components/auth/update-password-form"

export const metadata: Metadata = {
  title: "Nueva contraseña · Plan Financiero",
  robots: { index: false },
}

/** Destino del link de "recuperar contraseña" (configurado en resetPasswordForEmail). */
export default function UpdatePasswordPage() {
  return (
    <AuthShell>
      <UpdatePasswordForm />
    </AuthShell>
  )
}
