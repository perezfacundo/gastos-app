/**
 * Sesión de usuario como store externo (mismo patrón que el store financiero).
 *
 * Supabase guarda la sesión en el navegador y emite eventos cuando cambia
 * (login, logout, renovación de token, link de recuperación). Este módulo los
 * convierte en un snapshot que React lee con `useSyncExternalStore`.
 */
import type { Session } from "@supabase/supabase-js"

import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client"

export interface AuthSnapshot {
  status: "loading" | "signed-in" | "signed-out" | "unconfigured"
  session: Session | null
  /** true si se entró desde el link de "recuperar contraseña". */
  recovery: boolean
}

const SERVER_SNAPSHOT: AuthSnapshot = { status: "loading", session: null, recovery: false }

let snapshot: AuthSnapshot = SERVER_SNAPSHOT
let started = false
const listeners = new Set<() => void>()

function set(patch: Partial<AuthSnapshot>) {
  snapshot = { ...snapshot, ...patch }
  listeners.forEach((l) => l())
}

/** Se engancha a Supabase una sola vez, recién cuando alguien se suscribe (en el cliente). */
function start() {
  if (started) return
  started = true
  if (!isSupabaseConfigured()) {
    set({ status: "unconfigured" })
    return
  }
  // Emite INITIAL_SESSION apenas se registra, y luego cada cambio.
  getSupabase().auth.onAuthStateChange((event, session) => {
    set({
      status: session ? "signed-in" : "signed-out",
      session,
      recovery: event === "PASSWORD_RECOVERY" ? true : event === "SIGNED_OUT" ? false : snapshot.recovery,
    })
  })
}

export const authStore = {
  subscribe(listener: () => void) {
    start()
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getSnapshot: () => snapshot,
  getServerSnapshot: () => SERVER_SNAPSHOT,
}
