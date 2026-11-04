import { MinusIcon, TrendingDownIcon, TrendingUpIcon, TriangleAlertIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { fmtDate, fmtIndicator, fmtMonthYear, fmtPercent } from "@/lib/economia/format"
import type { Trend } from "@/lib/economia/indicators"
import type { IndicatorView } from "@/lib/economia/view"

const TREND: Record<Trend, { label: string; Icon: typeof MinusIcon }> = {
  alta: { label: "Em alta", Icon: TrendingUpIcon },
  queda: { label: "Em queda", Icon: TrendingDownIcon },
  estavel: { label: "Estável", Icon: MinusIcon },
}

export function IndicatorCard({ indicator: ind }: { indicator: IndicatorView }) {
  const ref = ind.date ? (ind.granularity === "mes" ? fmtMonthYear(ind.date) : fmtDate(ind.date)) : null
  const t = ind.trend ? TREND[ind.trend] : null

  return (
    <Card size="sm" className={ind.stale ? "border-dashed" : undefined}>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {ind.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {ind.value === null ? (
          <>
            <p className="text-lg font-semibold text-muted-foreground">Indisponível</p>
            <p className="text-sm text-muted-foreground">Não foi possível obter este indicador agora.</p>
          </>
        ) : (
          <>
            <p className="text-2xl font-bold tracking-tight tabular-nums">
              {fmtIndicator(ind.id, ind.value)}
              {ind.id === "selic" || ind.id === "cdi" ? (
                <span className="ml-1 text-sm font-medium text-muted-foreground">ao ano</span>
              ) : ind.id === "ipca" ? (
                <span className="ml-1 text-sm font-medium text-muted-foreground">em 12 meses</span>
              ) : null}
            </p>
            {ref && (
              <p className="text-xs text-muted-foreground">
                {ind.granularity === "mes" ? "Mês de referência" : "Referência"}: {ref}
              </p>
            )}
            {t ? (
              <div className="flex flex-col gap-0.5">
                <Badge variant="secondary" className="w-fit">
                  <t.Icon data-icon="inline-start" />
                  {t.label}
                </Badge>
                {ind.previousValue !== null && (
                  <p className="text-xs text-muted-foreground">
                    {ind.comparison}: {fmtIndicator(ind.id, ind.previousValue)}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Sem dado anterior para comparar.</p>
            )}
            {ind.monthly && (
              <p className="text-xs text-muted-foreground">
                Variação em {fmtMonthYear(ind.monthly.date)}: {fmtPercent(ind.monthly.value)}
              </p>
            )}
            {ind.stale && ref && (
              <p className="flex items-start gap-1.5 text-xs" role="status">
                <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0 text-primary" />
                Dado de {ref}: pode estar desatualizado.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
