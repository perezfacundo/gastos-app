"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { Field } from "@/components/finance/shared/form-fields"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/hooks/use-auth"
import { authErrorMessage } from "@/lib/auth/errors"
import { getSupabase } from "@/lib/supabase/client"

const MIN_PASSWORD = 8

/**
 * Destino del link de "recuperar contraseña". Supabase procesa el token del
 * link (detectSessionInUrl) y abre una sesión temporal con la que se puede
 * cambiar la contraseña.
 */
export function UpdatePasswordForm() {
  const auth = useAuth()
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; form?: string }>({})
  const [busy, setBusy] = useState(false)

  if (auth.status === "loading") return <Skeleton className="h-72 w-full" />

  if (auth.status !== "signed-in") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>El link no es válido</CardTitle>
          <CardDescription>Puede haber expirado o ya se usó. Pedí uno nuevo desde la pantalla de ingreso.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/login">Ir a ingresar</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const found: typeof errors = {}
    if (password.length < MIN_PASSWORD) found.password = `Mínimo ${MIN_PASSWORD} caracteres.`
    if (confirm !== password) found.confirm = "Las contraseñas no coinciden."
    setErrors(found)
    if (Object.keys(found).length) return

    setBusy(true)
    const { error } = await getSupabase().auth.updateUser({ password })
    setBusy(false)
    if (error) return setErrors({ form: authErrorMessage(error) })

    toast.success("Contraseña actualizada")
    router.replace("/")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nueva contraseña</CardTitle>
        <CardDescription>Para {auth.session?.user.email}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="grid gap-4">
          <Field label="Nueva contraseña" error={errors.password} hint={`Mínimo ${MIN_PASSWORD} caracteres.`}>
            {(p) => (
              <Input {...p} type="password" autoComplete="new-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
            )}
          </Field>
          <Field label="Repetir contraseña" error={errors.confirm}>
            {(p) => (
              <Input {...p} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            )}
          </Field>
          {errors.form && (
            <p role="alert" className="rounded-md bg-bad/10 px-3 py-2 text-sm text-bad-ink">
              {errors.form}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? "Guardando…" : "Guardar contraseña"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
