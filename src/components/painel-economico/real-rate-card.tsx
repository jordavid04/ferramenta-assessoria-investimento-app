import { PercentIcon, TriangleAlertIcon } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { fmtDate, fmtMonthYear, fmtPercent } from "@/lib/economia/format"
import type { RealRateView } from "@/lib/economia/view"

/** Juro real: calculado pelo sistema (Selic × IPCA 12 meses), nunca pela IA. */
export function RealRateCard({ real }: { real: RealRateView | null }) {
  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <PercentIcon className="size-3.5" />
          Juro real
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {real === null ? (
          <p className="text-sm text-muted-foreground">
            Não foi possível calcular o juro real agora: falta a Selic ou a inflação (IPCA) atualizada.
          </p>
        ) : (
          <>
            <p className="text-3xl font-bold tracking-tight tabular-nums">
              {fmtPercent(real.value)}
              <span className="ml-1 text-base font-medium text-muted-foreground">ao ano</span>
            </p>
            <p className="leading-relaxed">
              {real.value < 0
                ? `Descontada a inflação, o juro está negativo em ${fmtPercent(real.value)} ao ano: a inflação é maior do que a Selic paga.`
                : `Descontada a inflação, o juro está em ${fmtPercent(real.value)} ao ano.`}
            </p>
            <CardDescription className="leading-relaxed">
              Juro real é o que o dinheiro rende acima da inflação. Aqui, comparamos a Selic de {fmtPercent(real.selic)} ao
              ano ({fmtDate(real.selicDate)}) com a inflação dos últimos 12 meses, de {fmtPercent(real.ipca12m)} (IPCA até{" "}
              {fmtMonthYear(real.ipcaDate)}). O cálculo é feito pelo sistema, não pela IA.
            </CardDescription>
            {real.stale && (
              <p className="flex items-start gap-1.5 text-xs" role="status">
                <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0 text-primary" />
                Um dos dados usados no cálculo pode estar desatualizado.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
