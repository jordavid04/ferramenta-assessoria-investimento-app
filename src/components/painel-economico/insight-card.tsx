import Link from "next/link"
import { ClipboardListIcon, InfoIcon, RotateCcwIcon, SparklesIcon, WifiOffIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { fmtDate } from "@/lib/economia/format"
import type { LeituraResponse } from "@/lib/economia/leitura"

export function InsightSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando leitura do cenário">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-28 w-full rounded-2xl" />
    </div>
  )
}

/** Orientação ao usuário conforme o perfil conhecido. Montada pelo sistema, não pela IA. */
function ProfileNotice({ leitura }: { leitura: LeituraResponse }) {
  switch (leitura.state) {
    case "anonimo":
    case "sem-analise":
      return (
        <Alert>
          <ClipboardListIcon />
          <AlertTitle>Esta é uma leitura geral</AlertTitle>
          <AlertDescription>
            <p>
              {leitura.state === "sem-analise"
                ? "Você ainda não fez o questionário. "
                : "Responda o questionário de perfil para receber a leitura do cenário feita para você. "}
              Leva poucos minutos.
            </p>
            <Button size="sm" className="mt-2 cursor-pointer" render={<Link href="/suitability" />} nativeButton={false}>
              <ClipboardListIcon data-icon="inline-start" />
              Responder o questionário
            </Button>
          </AlertDescription>
        </Alert>
      )
    case "perfil-antigo":
      return (
        <Alert>
          <RotateCcwIcon />
          <AlertTitle>Seu perfil tem mais de 12 meses</AlertTitle>
          <AlertDescription>
            <p>
              A leitura usa o perfil {leitura.profile}, da análise de{" "}
              {leitura.analysisDate ? fmtDate(leitura.analysisDate) : "mais de um ano atrás"}. Sua situação pode ter mudado:
              vale refazer o questionário.
            </p>
            <Button size="sm" variant="outline" className="mt-2 cursor-pointer" render={<Link href="/suitability" />} nativeButton={false}>
              <RotateCcwIcon data-icon="inline-start" />
              Refazer questionário
            </Button>
          </AlertDescription>
        </Alert>
      )
    case "perfil-indisponivel":
      return (
        <Alert>
          <InfoIcon />
          <AlertTitle>Leitura geral</AlertTitle>
          <AlertDescription>Não foi possível consultar seu perfil agora, então mostramos a leitura geral do cenário.</AlertDescription>
        </Alert>
      )
    default:
      return null
  }
}

export function InsightCard({ leitura }: { leitura: LeituraResponse | null }) {
  if (leitura === null || leitura.insight === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-bold">Leitura do cenário</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {leitura === null
              ? "Não foi possível carregar a leitura do cenário agora. Os indicadores acima continuam valendo."
              : "A leitura do cenário depende dos dados dos indicadores, que estão indisponíveis no momento."}
          </p>
          {leitura && <ProfileNotice leitura={leitura} />}
        </CardContent>
      </Card>
    )
  }

  const { insight, source } = leitura
  return (
    <Card className="border-l-4 border-l-ai">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-ai-bg text-ai">
            <SparklesIcon />
          </span>
          <CardTitle className="font-bold">Leitura do cenário</CardTitle>
          <Badge variant="secondary">
            {source === "gemini" ? (
              <>
                <SparklesIcon data-icon="inline-start" />
                Gemini
              </>
            ) : (
              <>
                <WifiOffIcon data-icon="inline-start" />
                Offline
              </>
            )}
          </Badge>
          {leitura.profile && leitura.state !== "perfil-antigo" && (
            <Badge variant="outline">
              Perfil {leitura.profile}
              {leitura.analysisDate ? ` · análise de ${fmtDate(leitura.analysisDate)}` : ""}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="leading-relaxed text-foreground">{insight.reading}</p>

        <ul className="flex flex-col gap-2 text-sm">
          {insight.classNotes.map((n) => (
            <li key={n.assetClass} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
              <span className="font-semibold sm:w-40 sm:shrink-0">{n.assetClass}</span>
              <span className="leading-relaxed text-muted-foreground">{n.note}</span>
            </li>
          ))}
        </ul>

        <CardDescription>
          {source === "gemini" ? "Texto gerado pelo Google Gemini a partir dos números acima." : "Texto gerado pelo motor local (modo offline)."}{" "}
          Os números e o perfil são calculados pelo sistema, não pela IA.
        </CardDescription>

        {source === "fallback" && (
          <Alert>
            <WifiOffIcon />
            <AlertTitle>Modo offline</AlertTitle>
            <AlertDescription>A IA estava indisponível; usamos o texto local para manter a explicação educacional.</AlertDescription>
          </Alert>
        )}

        <ProfileNotice leitura={leitura} />
      </CardContent>
    </Card>
  )
}
