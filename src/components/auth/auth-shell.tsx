import { Wallet } from "lucide-react"
import Link from "next/link"

/** Marco centrado para las pantallas de login / registro / recuperación. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-4 py-10">
      <Link href="/" className="flex items-center gap-2.5" aria-label="Plan Financiero, inicio">
        <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground" aria-hidden="true">
          <Wallet className="size-5" />
        </span>
        <span className="leading-tight">
          <span className="block text-lg font-semibold">Plan Financiero</span>
          <span className="block text-xs text-muted-foreground">Planificá antes de gastar</span>
        </span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
      <p className="text-center text-xs text-muted-foreground">
        <Link href="/privacidad" className="underline underline-offset-3 hover:text-foreground">
          Privacidad y términos
        </Link>
      </p>
    </main>
  )
}
