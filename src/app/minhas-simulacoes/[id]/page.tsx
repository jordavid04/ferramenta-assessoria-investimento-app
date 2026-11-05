"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeftIcon, CalculatorIcon, HistoryIcon } from "lucide-react"
import { toast } from "sonner"
import { LeituraCard } from "@/components/simulador/leitura-card"
import { ResultadoSimulacao } from "@/components/simulador/resultado-simulacao"
import type { SimulationView } from "@/components/simulador/tipos"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { SHORT_TERM_YEARS } from "@/lib/simulador/premissas"
import type { ClassPercent, Projection } from "@/lib/simulador/projecao"
import type { SimRates } from "@/lib/simulador/taxas"
import type { Profile } from "@/lib/suitability/scoring"

type Stored = {
  id: string
  createdAt: string
  profile: Profile
  profileOrigin: "analise" | "exemplo"
  allocation: ClassPercent[]
  rates: SimRates
  result: Projection
  source: "gemini" | "fallback"
  reading: string
}

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" })

export default function SimulacaoSalvaPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  // undefined = carregando · null = não encontrada ou falhou · objeto = simulação
  const [data, setData] = useState<Stored | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/simulador/salvas/${params.id}`)
        if (res.status === 401) {
          router.replace(`/entrar?next=${encodeURIComponent(`/minhas-simulacoes/${params.id}`)}`)
          return
        }
        if (!res.ok) throw new Error()
        const parsed = (await res.json()) as Stored
        if (cancelled) return
        setData(parsed)
        if (parsed.source === "fallback") {
          toast.info("Modo offline", { description: "A leitura desta simulação foi gerada pelo texto local." })
        }
      } catch {
        if (!cancelled) setData(null)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [params.id, router])

  if (data === undefined) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando simulação">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    )
  }

  if (data === null) {
    return (
      <Empty className="border border-dashed py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HistoryIcon />
          </EmptyMedia>
          <EmptyTitle>Simulação não encontrada</EmptyTitle>
          <EmptyDescription>Ela não existe ou não pertence à sua conta.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button className="cursor-pointer" render={<Link href="/minhas-simulacoes" />} nativeButton={false}>
            <ArrowLeftIcon data-icon="inline-start" />
            Minhas simulações
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  const view: SimulationView = {
    origem: data.profileOrigin,
    profile: data.profile,
    allocation: data.allocation,
    rates: data.rates,
    projection: data.result,
    shortTerm: data.result.input.years < SHORT_TERM_YEARS,
    // Simulação salva: não reavaliamos a idade do perfil aqui, só mostramos o que foi guardado.
    estado: undefined,
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" className="w-fit cursor-pointer" render={<Link href="/minhas-simulacoes" />} nativeButton={false}>
          <ArrowLeftIcon data-icon="inline-start" />
          Minhas simulações
        </Button>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          <CalculatorIcon className="size-7 text-secondary" />
          Simulação de {dateFormat.format(new Date(data.createdAt))}
        </h1>
        <p className="text-muted-foreground">
          Valores calculados na data da simulação, com o CDI e a inflação daquele momento. Refazer a simulação hoje pode dar resultados diferentes.
        </p>
      </header>
      <ResultadoSimulacao view={view} reading={<LeituraCard reading={{ reading: data.reading, source: data.source }} profile={data.profile} />} />
    </div>
  )
}
