import { ProtectedApp } from "@/components/finance/protected-app"

/**
 * Página principal (Server Component). Requiere sesión: <ProtectedApp />
 * redirige a /login si no hay usuario y, si lo hay, carga sus datos.
 */
export default function Home() {
  return <ProtectedApp />
}
