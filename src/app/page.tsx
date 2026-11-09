import { FinanceApp } from "@/components/finance/finance-app"

/**
 * Página única (Server Component). Toda la interactividad vive en <FinanceApp />,
 * un Client Component, porque depende de localStorage.
 */
export default function Home() {
  return <FinanceApp />
}
