"use client"

import { useMemo } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { AvisoReavaliacao, EvolucaoCard, SemEvolucao } from "./evolucao-card"
import { IsolarFalha } from "./isolar-falha"
import { corpoDoPedido, useRelatorio } from "./use-relatorio"

function Conteudo({ idMaisRecente }: { idMaisRecente: string }) {
  const corpo = useMemo(() => corpoDoPedido(idMaisRecente, null), [idMaisRecente])
  const { relatorio: estado } = useRelatorio(corpo, false)

  if (estado.tipo === "carregando") {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando sua evolução">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }
  // Qualquer outra falha: some em silêncio. A lista de análises logo abaixo não depende deste cartão.
  if (estado.tipo !== "ok") return null

  const relatorio = estado.relatorio
  return (
    <section className="flex flex-col gap-4" aria-label="Sua evolução">
      <AvisoReavaliacao relatorio={relatorio} />
      {relatorio.evolucao ? <EvolucaoCard relatorio={relatorio} titulo="Sua evolução" /> : <SemEvolucao relatorio={relatorio} />}
    </section>
  )
}

/** Cartão "Sua evolução" do histórico: radar da análise mais recente sobreposto ao da anterior, o que mudou e o lembrete de 12 meses. */
export function MinhaEvolucao({ idMaisRecente }: { idMaisRecente: string }) {
  return (
    <IsolarFalha>
      <Conteudo idMaisRecente={idMaisRecente} />
    </IsolarFalha>
  )
}
