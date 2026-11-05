"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CalculatorIcon, HistoryIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { fmtBRL } from "@/lib/economia/format"
import { fmtYears } from "@/lib/simulador/format"

type Summary = {
  id: string
  createdAt: string
  profile: string
  profileOrigin: "analise" | "exemplo"
  input: { initial?: number; monthly?: number; years?: number; goal?: number | null } | null
  baseFinal: number | null
}

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" })

export default function MinhasSimulacoesPage() {
  const router = useRouter()
  const [items, setItems] = useState<Summary[] | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch("/api/simulador/salvas")
        if (res.status === 401) {
          router.replace("/entrar?next=/minhas-simulacoes")
          return
        }
        if (!res.ok) throw new Error()
        const data = (await res.json()) as { simulations: Summary[] }
        if (!cancelled) setItems(data.simulations)
      } catch {
        if (!cancelled) setItems(null)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [router])

  if (items === undefined) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando simulações">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    )
  }

  if (items === null) {
    return (
      <Empty className="border border-dashed py-12">
        <EmptyHeader>
          <EmptyTitle>Não foi possível carregar</EmptyTitle>
          <EmptyDescription>Tente de novo em instantes. O banco pode estar indisponível.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          <HistoryIcon className="size-7 text-secondary" />
          Minhas simulações
        </h1>
        <p className="text-muted-foreground">Simulações salvas na sua conta, da mais recente para a mais antiga.</p>
      </header>

      {items.length === 0 ? (
        <Empty className="border border-dashed py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalculatorIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhuma simulação ainda</EmptyTitle>
            <EmptyDescription>Faça uma simulação estando logado e use “Salvar esta simulação” para guardá-la aqui.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="lg" className="cursor-pointer" render={<Link href="/simulador" />} nativeButton={false}>
              <CalculatorIcon data-icon="inline-start" />
              Fazer uma simulação
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((s) => (
            <li key={s.id}>
              <Link href={`/minhas-simulacoes/${s.id}`} className="block cursor-pointer">
                <Card className="transition-colors duration-200 hover:bg-muted/40">
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="font-bold">
                        {s.profileOrigin === "exemplo" ? `Perfil de exemplo: ${s.profile}` : `Perfil ${s.profile}`}
                      </CardTitle>
                      {s.baseFinal !== null && <Badge variant="secondary">Base: {fmtBRL(s.baseFinal)}</Badge>}
                    </div>
                    <CardDescription>{dateFormat.format(new Date(s.createdAt))}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {s.input
                      ? `${fmtBRL(s.input.initial ?? 0)} + ${fmtBRL(s.input.monthly ?? 0)}/mês por ${fmtYears(s.input.years ?? 0)}${s.input.goal ? ` · meta ${fmtBRL(s.input.goal)}` : ""}`
                      : "Abrir simulação"}
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
