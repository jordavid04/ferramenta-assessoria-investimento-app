"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookmarkIcon, CalculatorIcon, ChartColumnIcon, HistoryIcon, type LucideIcon } from "lucide-react"
import { useCurrentUser } from "@/components/auth/use-current-user"
import { cn } from "@/lib/utils"

type Item = { href: string; label: string; icon: LucideIcon }

const FERRAMENTAS: Item[] = [
  { href: "/painel-economico", label: "Painel econômico", icon: ChartColumnIcon },
  { href: "/simulador", label: "Simulador", icon: CalculatorIcon },
]

const CONTA: Item[] = [
  { href: "/minhas-analises", label: "Minhas análises", icon: HistoryIcon },
  { href: "/minhas-simulacoes", label: "Minhas simulações", icon: BookmarkIcon },
]

function NavLink({ item, pathname }: { item: Item; pathname: string }) {
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-md border-l-2 px-3 py-2 text-sm transition-colors duration-200",
        active
          ? "border-l-primary bg-primary/10 font-semibold text-foreground"
          : "border-l-transparent text-muted-foreground hover:bg-primary/5 hover:text-foreground",
      )}
    >
      <item.icon className="size-4 shrink-0" />
      {item.label}
    </Link>
  )
}

/**
 * Menu lateral simples, sem fundo, que acompanha a rolagem. O espaçamento (layout.tsx) é o mesmo entre a borda
 * esquerda da tela e o menu e entre o menu e o conteúdo; o topo alinha com o topo do conteúdo.
 * Aparece a partir de `sm`; em telas menores esses mesmos links ficam no menu do cabeçalho.
 */
export function SiteSidebar() {
  const pathname = usePathname()
  const user = useCurrentUser()

  return (
    <aside className="hidden w-44 shrink-0 sm:block lg:w-56">
      <nav aria-label="Menu lateral" className="sticky top-8 flex flex-col gap-1">
        <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ferramentas</p>
        {FERRAMENTAS.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}

        {user && (
          <>
            <p className="mt-4 px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Minha conta</p>
            {CONTA.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </>
        )}
      </nav>
    </aside>
  )
}
