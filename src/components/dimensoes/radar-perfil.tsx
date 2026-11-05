"use client"

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import type { DimensionId } from "@/lib/dimensoes/mapeamento"

export interface PontoRadar {
  id: DimensionId
  nome: string
  nota: number
}

/** Rótulos curtos nos eixos (os nomes completos aparecem na lista abaixo do gráfico). */
const CURTO: Record<DimensionId, string> = {
  tolerancia: "Tolerância",
  horizonte: "Horizonte",
  conhecimento: "Conhecimento",
  situacao: "Situação",
  objetivo: "Objetivo",
}

const config = {
  atual: { label: "Atual", color: "var(--chart-1)" },
  anterior: { label: "Análise anterior", color: "var(--chart-5)" },
} satisfies ChartConfig

/**
 * Radar das dimensões (0 a 100%). Com `anterior`, mostra as duas análises sobrepostas; a anterior é tracejada,
 * para a diferença não depender só da cor.
 */
export function RadarPerfil({
  atual,
  anterior,
  rotuloAtual = "Atual",
  rotuloAnterior = "Análise anterior",
}: {
  atual: PontoRadar[]
  anterior?: PontoRadar[] | null
  rotuloAtual?: string
  rotuloAnterior?: string
}) {
  const data = atual.map((p) => ({
    dimensao: CURTO[p.id],
    atual: p.nota,
    anterior: anterior?.find((a) => a.id === p.id)?.nota,
  }))
  const resumo =
    `Radar das dimensões, de 0 a 100%. ${rotuloAtual}: ${atual.map((p) => `${p.nome} ${p.nota}%`).join(", ")}.` +
    (anterior ? ` ${rotuloAnterior}: ${anterior.map((p) => `${p.nome} ${p.nota}%`).join(", ")}.` : "")

  return (
    <div className="flex flex-col gap-2">
      <div role="img" aria-label={resumo}>
        <ChartContainer config={config} className="mx-auto aspect-square h-72 w-full max-w-sm">
          <RadarChart data={data} outerRadius="72%">
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => (
                    <span className="flex w-full items-center justify-between gap-4">
                      <span className="text-muted-foreground">{name === "anterior" ? rotuloAnterior : rotuloAtual}</span>
                      <span className="font-mono font-medium tabular-nums">{Number(value)}%</span>
                    </span>
                  )}
                />
              }
            />
            <PolarGrid />
            <PolarAngleAxis dataKey="dimensao" tick={{ fontSize: 12 }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            {anterior && (
              <Radar
                name="anterior"
                dataKey="anterior"
                stroke="var(--color-anterior)"
                fill="var(--color-anterior)"
                fillOpacity={0.12}
                strokeWidth={2}
                strokeDasharray="6 4"
                isAnimationActive={false}
              />
            )}
            <Radar
              name="atual"
              dataKey="atual"
              stroke="var(--color-atual)"
              fill="var(--color-atual)"
              fillOpacity={0.28}
              strokeWidth={2.5}
              dot={{ r: 3 }}
              isAnimationActive={false}
            />
          </RadarChart>
        </ChartContainer>
      </div>
      {anterior && (
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legenda do gráfico">
          <li className="flex items-center gap-1.5">
            <svg width="22" height="6" aria-hidden="true">
              <line x1="0" y1="3" x2="22" y2="3" stroke="var(--chart-1)" strokeWidth="2.5" />
            </svg>
            {rotuloAtual}
          </li>
          <li className="flex items-center gap-1.5">
            <svg width="22" height="6" aria-hidden="true">
              <line x1="0" y1="3" x2="22" y2="3" stroke="var(--chart-5)" strokeWidth="2" strokeDasharray="6 4" />
            </svg>
            {rotuloAnterior}
          </li>
        </ul>
      )}
    </div>
  )
}
