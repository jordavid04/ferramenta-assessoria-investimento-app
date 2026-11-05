"use client"

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { fmtBRL } from "@/lib/economia/format"
import { fmtYears } from "@/lib/simulador/format"
import type { Projection } from "@/lib/simulador/projecao"

const config = {
  pessimista: { label: "Pessimista", color: "var(--destructive)" },
  base: { label: "Base", color: "var(--chart-1)" },
  otimista: { label: "Otimista", color: "var(--chart-2)" },
  invested: { label: "Total investido", color: "var(--chart-5)" },
  inflation: { label: "Só acompanhar a inflação", color: "var(--chart-3)" },
} satisfies ChartConfig

type Key = keyof typeof config

/** Estilo de traço: as referências são tracejadas, para não depender só da cor. */
const DASH: Partial<Record<Key, string>> = { invested: "6 4", inflation: "2 3" }

const compact = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 })

export function EvolucaoChart({ projection }: { projection: Projection }) {
  const data = projection.series.map((p) => ({ ...p, label: p.month === 0 ? "Hoje" : fmtYears(p.month / 12) }))
  const last = projection.series.at(-1)!
  const summary = `Evolução hipotética do patrimônio em ${fmtYears(projection.months / 12)}: no fim, pessimista ${fmtBRL(last.pessimista)}, base ${fmtBRL(last.base)}, otimista ${fmtBRL(last.otimista)}, com ${fmtBRL(last.invested)} investidos.`

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-bold">Evolução ao longo do tempo</CardTitle>
        <CardDescription>Cada linha é uma hipótese, não uma previsão. A linha tracejada mostra o total que você colocou.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div role="img" aria-label={summary}>
          <ChartContainer config={config} className="aspect-auto h-72 w-full">
            <LineChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis width={72} tickLine={false} axisLine={false} tickFormatter={(v: number) => compact.format(v)} />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => (
                      <span className="flex w-full items-center justify-between gap-4">
                        <span className="text-muted-foreground">{config[name as Key]?.label ?? name}</span>
                        <span className="font-mono font-medium tabular-nums">{fmtBRL(Number(value))}</span>
                      </span>
                    )}
                  />
                }
              />
              {(["otimista", "base", "pessimista", "invested", "inflation"] as Key[]).map((key) => (
                <Line
                  key={key}
                  dataKey={key}
                  name={key}
                  type="monotone"
                  stroke={`var(--color-${key})`}
                  strokeWidth={key === "base" ? 2.5 : 2}
                  strokeDasharray={DASH[key]}
                  dot={data.length <= 2}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ChartContainer>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legenda do gráfico">
          {(Object.keys(config) as Key[]).map((key) => (
            <li key={key} className="flex items-center gap-1.5">
              <svg width="22" height="6" aria-hidden="true">
                <line x1="0" y1="3" x2="22" y2="3" stroke={config[key].color} strokeWidth="2" strokeDasharray={DASH[key]} />
              </svg>
              {config[key].label}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
