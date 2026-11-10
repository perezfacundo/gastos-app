"use client"

import { useSyncExternalStore } from "react"

import { authStore, type AuthSnapshot } from "@/lib/auth/session-store"

/** Sesión actual. `status: "loading"` en el servidor y mientras Supabase la restaura. */
export function useAuth(): AuthSnapshot {
  return useSyncExternalStore(authStore.subscribe, authStore.getSnapshot, authStore.getServerSnapshot)
}
