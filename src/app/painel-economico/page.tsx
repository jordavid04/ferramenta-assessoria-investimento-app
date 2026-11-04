"use client"

import { useEffect, useState } from "react"
import { ChartColumnIcon, InfoIcon, TriangleAlertIcon } from "lucide-react"
import { toast } from "sonner"
import { HistorySection } from "@/components/painel-economico/history-chart"
import { IndicatorCard } from "@/components/painel-economico/indicator-card"
import { InsightCard, InsightSkeleton } from "@/components/painel-economico/insight-card"
import { RealRateCard } from "@/components/painel-economico/real-rate-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { ECONOMIC_DISCLAIMER, fmtDayMonth } from "@/lib/economia/format"
import type { LeituraResponse } from "@/lib/economia/leitura"
import type { EconomicSnapshot } from "@/lib/economia/snapshot"

function PainelSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando indicadores">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-36 w-full rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  )
}

export default function PainelEconomicoPage() {
  // undefined = carregando · null = falhou · objeto = dados
  const [snapshot, setSnapshot] = useState<EconomicSnapshot | null | undefined>(undefined)
  const [leitura, setLeitura] = useState<LeituraResponse | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    async function loadSnapshot() {
      try {
        const res = await fetch("/api/painel-economico")
        if (!res.ok) throw new Error()
        const data = (await res.json()) as EconomicSnapshot
        if (!cancelled) setSnapshot(data)
      } catch {
        if (!cancelled) setSnapshot(null)
      }
    }
    async function loadLeitura() {
      try {
        const res = await fetch("/api/painel-economico/leitura")
        if (!res.ok) throw new Error()
        const data = (await res.json()) as LeituraResponse
        if (cancelled) return
        setLeitura(data)
        if (data.source === "fallback") {
          toast.info("Modo offline", { description: "A leitura do cenário foi gerada pelo texto local." })
        }
      } catch {
        if (!cancelled) setLeitura(null)
      }
    }
    void loadSnapshot()
    void loadLeitura()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          <ChartColumnIcon className="size-7 text-secondary" />
          Painel econômico
        </h1>
        <p className="text-muted-foreground">
          O cenário econômico do Brasil com dados oficiais do Banco Central e o que ele significa para o investidor.
        </p>
      </header>

      {snapshot === undefined ? (
        <PainelSkeleton />
      ) : snapshot === null || snapshot.status === "indisponivel" ? (
        <Empty className="border border-dashed py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TriangleAlertIcon />
            </EmptyMedia>
            <EmptyTitle className="text-xl">Indicadores indisponíveis no momento</EmptyTitle>
            <EmptyDescription>
              Não foi possível consultar os dados do Banco Central e ainda não há dados guardados. Tente de novo em
              instantes. O restante do site continua funcionando.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          {snapshot.status === "cache" && snapshot.updatedAt && (
            <Alert>
              <TriangleAlertIcon />
              <AlertTitle>Dados atualizados em {fmtDayMonth(snapshot.updatedAt)}</AlertTitle>
              <AlertDescription>
                Não conseguimos consultar o Banco Central agora, então mostramos o último dado guardado.
              </AlertDescription>
            </Alert>
          )}

          <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {snapshot.indicators.map((ind) => (
              <IndicatorCard key={ind.id} indicator={ind} />
            ))}
          </section>

          <RealRateCard real={snapshot.realRate} />
        </>
      )}

      {leitura === undefined ? <InsightSkeleton /> : <InsightCard leitura={leitura} />}

      {snapshot && snapshot.status !== "indisponivel" && <HistorySection indicators={snapshot.indicators} />}

      <Alert>
        <InfoIcon />
        <AlertTitle>Aviso importante</AlertTitle>
        <AlertDescription>{ECONOMIC_DISCLAIMER}</AlertDescription>
      </Alert>
    </div>
  )
}
