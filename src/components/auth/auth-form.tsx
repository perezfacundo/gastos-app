"use client"

import { MailCheck } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { Field } from "@/components/finance/shared/form-fields"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/hooks/use-auth"
import { authErrorMessage } from "@/lib/auth/errors"
import { getSupabase } from "@/lib/supabase/client"

type Mode = "sign-in" | "sign-up" | "forgot"
const MIN_PASSWORD = 8

/** Ingresar / crear cuenta / recuperar contraseña, en una sola tarjeta. */
export function AuthForm() {
  const auth = useAuth()
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("sign-in")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string>()
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [busy, setBusy] = useState(false)
  /** Pantalla "revisá tu email" tras registrarse o pedir recuperación. */
  const [sentTo, setSentTo] = useState<{ email: string; kind: "confirm" | "reset" } | null>(null)

  // Si ya hay sesión (o se acaba de iniciar), ir a la app.
  useEffect(() => {
    if (auth.status === "signed-in") router.replace("/")
  }, [auth.status, router])

  function changeMode(next: Mode) {
    setMode(next)
    setError(undefined)
    setFieldErrors({})
  }

  function validate() {
    const found: typeof fieldErrors = {}
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) found.email = "Ingresá un email válido."
    if (mode !== "forgot" && password.length < (mode === "sign-up" ? MIN_PASSWORD : 1)) {
      found.password = mode === "sign-up" ? `Mínimo ${MIN_PASSWORD} caracteres.` : "Ingresá tu contraseña."
    }
    setFieldErrors(found)
    return Object.keys(found).length === 0
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(undefined)
    if (!validate()) return
    setBusy(true)
    const supabase = getSupabase()
    const cleanEmail = email.trim().toLowerCase()
    // Los links de los emails vuelven a ESTE sitio (localhost o producción).
    const origin = window.location.origin

    try {
      if (mode === "sign-in") {
        const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password })
        if (error) throw error
        // La redirección la hace el efecto al cambiar la sesión.
      } else if (mode === "sign-up") {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { emailRedirectTo: `${origin}/` },
        })
        if (error) throw error
        // Con confirmación de email activada no hay sesión hasta hacer clic en el link.
        if (!data.session) setSentTo({ email: cleanEmail, kind: "confirm" })
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${origin}/actualizar-clave`,
        })
        if (error) throw error
        setSentTo({ email: cleanEmail, kind: "reset" })
      }
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (sentTo) {
    return (
      <Card>
        <CardHeader className="items-center text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-good/10 text-good-ink">
            <MailCheck className="size-6" aria-hidden="true" />
          </span>
          <CardTitle>Revisá tu email</CardTitle>
          <CardDescription>
            {sentTo.kind === "confirm"
              ? `Te enviamos un link a ${sentTo.email} para confirmar tu cuenta.`
              : `Si existe una cuenta con ${sentTo.email}, te llegará un link para crear una nueva contraseña.`}{" "}
            Puede tardar unos minutos; mirá también en spam.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setSentTo(null)
              changeMode("sign-in")
            }}
          >
            Volver a ingresar
          </Button>
        </CardContent>
      </Card>
    )
  }

  const titles: Record<Mode, { title: string; description: string; submit: string }> = {
    "sign-in": { title: "Ingresá a tu cuenta", description: "Tus datos se sincronizan en todos tus dispositivos.", submit: "Ingresar" },
    "sign-up": { title: "Creá tu cuenta", description: "Gratis. Solo necesitás un email.", submit: "Crear cuenta" },
    forgot: { title: "Recuperar contraseña", description: "Te enviamos un link para crear una nueva.", submit: "Enviar link" },
  }
  const copy = titles[mode]

  return (
    <Card>
      <CardHeader>
        {mode !== "forgot" && (
          <Tabs value={mode} onValueChange={(v) => changeMode(v as Mode)} className="mb-2">
            <TabsList className="w-full">
              <TabsTrigger value="sign-in" className="flex-1">
                Ingresar
              </TabsTrigger>
              <TabsTrigger value="sign-up" className="flex-1">
                Crear cuenta
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="grid gap-4">
          <Field label="Email" error={fieldErrors.email}>
            {(p) => (
              <Input
                {...p}
                type="email"
                autoComplete="email"
                inputMode="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </Field>

          {mode !== "forgot" && (
            <Field
              label="Contraseña"
              error={fieldErrors.password}
              hint={mode === "sign-up" ? `Mínimo ${MIN_PASSWORD} caracteres.` : undefined}
            >
              {(p) => (
                <Input
                  {...p}
                  type="password"
                  autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              )}
            </Field>
          )}

          {error && (
            <p role="alert" className="rounded-md bg-bad/10 px-3 py-2 text-sm text-bad-ink">
              {error}
            </p>
          )}

          <Button type="submit" disabled={busy || auth.status === "unconfigured"}>
            {busy ? "Un momento…" : copy.submit}
          </Button>

          {mode === "sign-in" && (
            <Button type="button" variant="link" size="sm" onClick={() => changeMode("forgot")}>
              ¿Olvidaste tu contraseña?
            </Button>
          )}
          {mode === "forgot" && (
            <Button type="button" variant="link" size="sm" onClick={() => changeMode("sign-in")}>
              Volver a ingresar
            </Button>
          )}
          {mode === "sign-up" && (
            <p className="text-center text-xs text-muted-foreground">
              Al crear una cuenta aceptás los{" "}
              <Link href="/privacidad" className="underline underline-offset-3">
                términos y la política de privacidad
              </Link>
              .
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
