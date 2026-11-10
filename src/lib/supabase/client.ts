/**
 * Cliente de Supabase para el navegador.
 *
 * - La URL y la "publishable key" son PÚBLICAS por diseño: la seguridad real la
 *   dan las políticas RLS de la base de datos, no ocultar estas claves.
 * - NUNCA uses acá la "secret key" (ex service_role): saltea RLS.
 * - Las variables NEXT_PUBLIC_* se incrustan en el JS al hacer `next build`:
 *   en Vercel deben estar configuradas ANTES del build.
 * - El cliente se crea de forma perezosa: importar este archivo no falla aunque
 *   falten las variables (por ejemplo durante el prerender).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "./database.types"

// Referencias literales: Next.js solo reemplaza `process.env.NEXT_PUBLIC_X` escrito así.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

export type AppSupabaseClient = SupabaseClient<Database>

let client: AppSupabaseClient | null = null

export const isSupabaseConfigured = () => Boolean(SUPABASE_URL && SUPABASE_KEY)

export function getSupabase(): AppSupabaseClient {
  if (!client) {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error(
        "Faltan NEXT_PUBLIC_SUPABASE_URL y/o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copiá .env.example a .env.local."
      )
    }
    client = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true, // la sesión sobrevive a recargas
        autoRefreshToken: true, // renueva el token antes de que expire
        detectSessionInUrl: true, // procesa los links de confirmación / recuperación
        flowType: "implicit", // los links de email funcionan aunque se abran en otro navegador
      },
    })
  }
  return client
}
