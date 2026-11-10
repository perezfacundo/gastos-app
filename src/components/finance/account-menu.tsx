"use client"

import { Download, Eraser, LogOut, RotateCcw, ShieldCheck, Trash2, UserRound } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useFinanceMeta } from "@/hooks/use-finance"
import { financeActions } from "@/lib/finance/actions"
import { todayISO } from "@/lib/finance/format"
import { deleteMyAccount } from "@/lib/finance/remote"
import { financeStore } from "@/lib/finance/store"
import { getSupabase } from "@/lib/supabase/client"

import type { AppUser } from "./finance-app"

type Confirm = "sample" | "clear" | "delete-account" | "sign-out" | null

/** Menú de la cuenta: datos, privacidad, eliminar cuenta y cerrar sesión. */
export function AccountMenu({ user }: { user: AppUser }) {
  const router = useRouter()
  const { queued } = useFinanceMeta()
  const [confirm, setConfirm] = useState<Confirm>(null)

  async function signOut() {
    // scope "local": cierra la sesión en este dispositivo (los demás siguen abiertos).
    await getSupabase().auth.signOut({ scope: "local" })
    // Borra también la copia local: en un dispositivo compartido no quedan datos.
    await financeStore.reset()
    router.replace("/login")
  }

  /** Portabilidad: descarga todos los datos del usuario en JSON. */
  function exportData() {
    const state = financeStore.getSnapshot()
    if (!state) return
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), email: user.email, ...state }, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const link = Object.assign(document.createElement("a"), { href: url, download: `plan-financiero-${todayISO()}.json` })
    link.click()
    URL.revokeObjectURL(url)
    toast.success("Descargaste una copia de tus datos")
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" aria-label="Mi cuenta">
            <UserRound />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="truncate font-normal">
            <span className="block text-xs text-muted-foreground">Sesión iniciada como</span>
            <span className="block truncate font-medium text-foreground">{user.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={exportData}>
            <Download /> Exportar mis datos (JSON)
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setConfirm("sample")}>
            <RotateCcw /> Cargar datos de ejemplo
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setConfirm("clear")}>
            <Eraser /> Empezar de cero
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/privacidad">
              <ShieldCheck /> Privacidad y términos
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirm("delete-account")}>
            <Trash2 /> Eliminar mi cuenta
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {/* Con cambios sin sincronizar, pedir confirmación (se perderían). */}
          <DropdownMenuItem onSelect={() => (queued > 0 ? setConfirm("sign-out") : void signOut())}>
            <LogOut /> Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirm === "sign-out"} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tenés cambios sin sincronizar</AlertDialogTitle>
            <AlertDialogDescription>
              {queued} {queued === 1 ? "cambio todavía no llegó" : "cambios todavía no llegaron"} a la nube (sin conexión). Si cerrás
              sesión ahora, se van a perder. Te conviene esperar a tener internet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Esperar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void signOut()}>
              Cerrar sesión igual
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <DataConfirmDialog kind={confirm === "sample" || confirm === "clear" ? confirm : null} onClose={() => setConfirm(null)} />
      <DeleteAccountDialog
        open={confirm === "delete-account"}
        email={user.email}
        onClose={() => setConfirm(null)}
        onDeleted={async () => {
          // El usuario ya no existe: se limpia solo la sesión local.
          await getSupabase().auth.signOut({ scope: "local" })
          await financeStore.reset()
          toast.success("Tu cuenta y todos tus datos fueron eliminados")
          router.replace("/login")
        }}
      />
    </>
  )
}

function DataConfirmDialog({ kind, onClose }: { kind: "sample" | "clear" | null; onClose: () => void }) {
  const copy = {
    sample: {
      title: "¿Cargar datos de ejemplo?",
      description: "Se reemplazarán TODOS tus datos (movimientos, fijos, metas y límites) por un ejemplo.",
      action: "Reemplazar por ejemplo",
      run: financeActions.resetToSample,
      done: "Datos de ejemplo cargados",
    },
    clear: {
      title: "¿Empezar de cero?",
      description: "Se borrarán movimientos, fijos y metas. Las categorías se conservan sin límites. No se puede deshacer.",
      action: "Borrar todo",
      run: financeActions.clearAll,
      done: "Listo: empezás con un plan en blanco",
    },
  } as const
  const current = kind ? copy[kind] : null

  return (
    <AlertDialog open={kind !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{current?.title}</AlertDialogTitle>
          <AlertDialogDescription>{current?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              if (!current) return
              current.run().then(
                () => toast.success(current.done),
                () => undefined // el store ya mostró el error
              )
              onClose()
            }}
          >
            {current?.action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Eliminar cuenta: exige escribir el email para evitar accidentes. */
function DeleteAccountDialog({
  open,
  email,
  onClose,
  onDeleted,
}: {
  open: boolean
  email: string
  onClose: () => void
  onDeleted: () => Promise<void>
}) {
  const [typed, setTyped] = useState("")
  const [busy, setBusy] = useState(false)
  const matches = typed.trim().toLowerCase() === email.toLowerCase()

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setTyped("")
          onClose()
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar tu cuenta?</AlertDialogTitle>
          <AlertDialogDescription>
            Se borrarán de forma permanente tu cuenta y todos tus datos. Te recomendamos exportarlos antes. Esta acción no se puede
            deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="confirm-email">
            Escribí <span className="font-semibold">{email}</span> para confirmar
          </Label>
          <Input id="confirm-email" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={!matches || busy}
            onClick={async () => {
              setBusy(true)
              try {
                await deleteMyAccount()
                await onDeleted()
              } catch (error) {
                toast.error("No se pudo eliminar la cuenta", {
                  description: error instanceof Error ? error.message : "Intentá de nuevo.",
                })
                setBusy(false)
              }
            }}
          >
            {busy ? "Eliminando…" : "Eliminar definitivamente"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
