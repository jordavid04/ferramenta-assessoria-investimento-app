"use client"

import { useState } from "react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { fmtDate, fmtDayMonth, fmtIndicator, fmtMonthYear } from "@/lib/economia/format"
import { shiftDays } from "@/lib/economia/indicators"
import type { IndicatorView } from "@/lib/economia/view"

const PERIODS = [
  { id: "6m", label: "6 meses", days: 182 },
  { id: "1a", label: "1 ano", days: 365 },
  { id: "5a", label: "5 anos", days: 1826 },
] as const

type PeriodId = (typeof PERIODS)[number]["id"]

const COLOR: Record<IndicatorView["id"], string> = {
  selic: "var(--chart-1)",
  cdi: "var(--chart-2)",
  ipca: "var(--chart-3)",
  dolar: "var(--chart-4)",
}

function IndicatorChart({ indicator: ind, days, period }: { indicator: IndicatorView; days: number; period: PeriodId }) {
  const last = ind.history.at(-1)
  const data = last ? ind.history.filter((p) => p.date >= shiftDays(last.date, -days)) : []
  const config = { value: { label: ind.label, color: COLOR[ind.id] } } satisfies ChartConfig
  const monthlyAxis = ind.granularity === "mes" || period === "5a"
  const first = data[0]

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {ind.label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length < 2 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Sem histórico suficiente para este período.</p>
        ) : (
          <div
            role="img"
            aria-label={`Evolução de ${ind.label}: de ${fmtIndicator(ind.id, first.value)} em ${fmtDate(first.date)} a ${fmtIndicator(ind.id, last!.value)} em ${fmtDate(last!.date)}`}
          >
            <ChartContainer config={config} className="aspect-auto h-44 w-full">
              <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={36}
                  tickFormatter={(v: string) => (monthlyAxis ? fmtMonthYear(v) : fmtDayMonth(v))}
                />
                <YAxis
                  width={ind.id === "dolar" ? 44 : 48}
                  tickLine={false}
                  axisLine={false}
                  domain={["auto", "auto"]}
                  tickFormatter={(v: number) => (ind.id === "dolar" ? v.toFixed(2).replace(".", ",") : `${v.toFixed(1).replace(".", ",")}%`)}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      hideIndicator
                      labelFormatter={(_, payload) => {
                        const date = (payload?.[0]?.payload as { date?: string } | undefined)?.date
                        return date ? (ind.granularity === "mes" ? fmtMonthYear(date) : fmtDate(date)) : ""
                      }}
                      formatter={(value) => (
                        <span className="font-mono font-medium tabular-nums">{fmtIndicator(ind.id, Number(value))}</span>
                      )}
                    />
                  }
                />
                <Line
                  dataKey="value"
                  name={ind.label}
                  type={ind.id === "selic" ? "stepAfter" : "monotone"}
                  stroke="var(--color-value)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function HistorySection({ indicators }: { indicators: IndicatorView[] }) {
  const [period, setPeriod] = useState<PeriodId>("1a")
  const days = PERIODS.find((p) => p.id === period)!.days

  return (
    <section className="flex flex-col gap-3" aria-labelledby="historico-titulo">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="historico-titulo" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Histórico
        </h2>
        <div role="group" aria-label="Período do histórico" className="flex gap-1.5">
          {PERIODS.map((p) => (
            <Button
              key={p.id}
              type="button"
              size="sm"
              variant={period === p.id ? "default" : "outline"}
              aria-pressed={period === p.id}
              className="cursor-pointer"
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {indicators.map((ind) => (
          <IndicatorChart key={ind.id} indicator={ind} days={days} period={period} />
        ))}
      </div>
    </section>
  )
}
