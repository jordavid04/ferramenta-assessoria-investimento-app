import Link from "next/link"
import {
  BadgeCheckIcon,
  BoxesIcon,
  ChartColumnIcon,
  CheckCircle2Icon,
  ClipboardListIcon,
  InfoIcon,
  LayersIcon,
  LightbulbIcon,
  RotateCcwIcon,
  SparklesIcon,
  WifiOffIcon,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import type { RecommendationResult } from "@/lib/ai/prompt"

export interface ResultPayload {
  id: string | null
  score: number
  profile: "Conservador" | "Moderado" | "Arrojado" | "Agressivo"
  source: "gemini" | "fallback"
  recommendation: RecommendationResult
}

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]

const PROFILE_VARIANT: Record<ResultPayload["profile"], "default" | "secondary" | "outline"> = {
  Conservador: "secondary",
  Moderado: "outline",
  Arrojado: "default",
  Agressivo: "default",
}

export function ResultadoSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando resultado">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-28 w-full rounded-2xl" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-56 w-full rounded-2xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    </div>
  )
}

export function ResultadoEmpty({
  title = "Nenhum resultado encontrado",
  description = "Responda o questionário para ver seu perfil e a orientação educacional.",
}: {
  title?: string
  description?: string
}) {
  return (
    <Empty className="border border-dashed py-12">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ClipboardListIcon />
        </EmptyMedia>
        <EmptyTitle className="text-xl">{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button
          size="lg"
          className="cursor-pointer"
          render={<Link href="/suitability" />}
          nativeButton={false}
        >
          <ClipboardListIcon data-icon="inline-start" />
          Responder o questionário
        </Button>
      </EmptyContent>
    </Empty>
  )
}

export function ResultadoView({ data }: { data: ResultPayload }) {
  const { recommendation: r } = data
  const alloc = r.allocation.filter((a) => a.percent > 0)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 rounded-3xl border border-border bg-gradient-to-br from-nav to-secondary px-6 py-8 text-white sm:px-8">
        <div className="flex flex-col gap-1">
          <p className="flex items-center gap-1.5 text-sm font-medium text-slate-300">
            <BadgeCheckIcon className="size-4" />
            Seu perfil de investidor
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{data.profile}</h1>
          <p className="text-slate-200">Pontuação: {data.score} de 72</p>
        </div>
        <Badge variant={PROFILE_VARIANT[data.profile]} className="bg-white text-foreground">
          <BadgeCheckIcon data-icon="inline-start" />
          Perfil {data.profile}
        </Badge>
      </header>

      <Card className="border-l-4 border-l-ai">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-ai-bg text-ai">
              <SparklesIcon />
            </span>
            <CardTitle className="font-bold">Explicação do perfil</CardTitle>
            <Badge variant="secondary">
              {data.source === "gemini" ? (
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
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="leading-relaxed text-foreground">{r.profileExplanation}</p>
          <CardDescription>
            {data.source === "gemini"
              ? "Texto gerado pelo Google Gemini."
              : "Texto gerado pelo motor local (modo offline)."}{" "}
            O perfil foi calculado pelas regras do questionário, não pela IA.
          </CardDescription>
          {data.source === "fallback" && (
            <Alert>
              <WifiOffIcon />
              <AlertTitle>Modo offline</AlertTitle>
              <AlertDescription>
                A IA estava indisponível; usamos o motor local para manter a orientação educacional.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <LayersIcon className="size-3.5" />
              Distribuição sugerida
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div
              className="flex h-4 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label="Distribuição da carteira"
            >
              {alloc.map((a, i) => (
                <div
                  key={a.assetClass}
                  style={{ width: `${a.percent}%`, background: COLORS[i % COLORS.length] }}
                  title={`${a.assetClass}: ${a.percent}%`}
                />
              ))}
            </div>
            <ul className="flex flex-col gap-4">
              {alloc.map((a, i) => (
                <li key={a.assetClass} className="text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="flex items-center gap-2 font-semibold">
                      <span
                        className="size-3 shrink-0 rounded-full"
                        style={{ background: COLORS[i % COLORS.length] }}
                      />
                      {a.assetClass}
                    </p>
                    <Badge variant="secondary">{a.percent}%</Badge>
                  </div>
                  <p className="mt-1 pl-5 text-muted-foreground">{a.rationale}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3">
          <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <BoxesIcon className="size-3.5" />
            Sugestões por classe de ativo
          </h2>
          {r.suggestions.map((s) => (
            <Card key={s.title} size="sm">
              <CardHeader>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold uppercase tracking-wide text-muted-foreground">
                    {s.assetClass}
                  </span>
                  <Badge variant="outline" className="text-success">
                    <CheckCircle2Icon data-icon="inline-start" />
                    Compatibilidade: {s.compatibility}%
                  </Badge>
                </div>
                <CardTitle className="font-bold">{s.title}</CardTitle>
                <CardDescription className="leading-relaxed">{s.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <LightbulbIcon className="text-primary" />
            <CardTitle className="font-bold">Dicas de educação financeira</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2 text-sm text-foreground">
            {r.educationalTips.map((t) => (
              <li key={t} className="flex gap-2">
                <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="leading-relaxed">{t}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Alert>
        <InfoIcon />
        <AlertTitle>Aviso importante</AlertTitle>
        <AlertDescription>{r.disclaimer}</AlertDescription>
      </Alert>

      <div className="flex flex-wrap gap-3">
        <Button
          size="lg"
          className="cursor-pointer"
          render={<Link href="/painel-economico" />}
          nativeButton={false}
        >
          <ChartColumnIcon data-icon="inline-start" />
          Ver cenário econômico
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="cursor-pointer"
          render={<Link href="/suitability" />}
          nativeButton={false}
        >
          <RotateCcwIcon data-icon="inline-start" />
          Refazer questionário
        </Button>
      </div>
    </div>
  )
}
