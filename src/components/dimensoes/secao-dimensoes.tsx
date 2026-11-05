"use client"

import { useMemo } from "react"
import { CheckCircle2Icon, InfoIcon, RadarIcon, SparklesIcon, TriangleAlertIcon, WifiOffIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { DISCLAIMER } from "@/lib/ai/prompt"
import { MENSAGEM_COERENCIA } from "@/lib/dimensoes/resumos"
import type { Alerta, NotaDimensao, Relatorio } from "@/lib/dimensoes/tipos"
import { AvisoReavaliacao, EvolucaoCard, SemEvolucao } from "./evolucao-card"
import { IsolarFalha } from "./isolar-falha"
import { RadarPerfil } from "./radar-perfil"
import { corpoDoPedido, useRelatorio, type EstadoLeitura } from "./use-relatorio"

const FAIXA_TEXTO = { baixa: "Baixa", media: "Média", alta: "Alta" } as const

const dataCurta = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" })

function SecaoSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando o perfil por dimensão">
      <Skeleton className="h-7 w-64" />
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  )
}

function LinhaDimensao({ d }: { d: NotaDimensao }) {
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{d.nome}</p>
        <Badge variant="secondary">
          {d.nota}% · {FAIXA_TEXTO[d.faixa]}
        </Badge>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${d.nome}: ${d.nota}%`}>
        <div className="h-full rounded-full bg-secondary" style={{ width: `${d.nota}%` }} />
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{d.resumo}</p>
      {d.detalhe && <p className="text-xs text-muted-foreground">Sua resposta: {d.detalhe}</p>}
      {d.perguntas < 3 && (
        <p className="text-xs text-muted-foreground">
          Baseada em {d.perguntas === 1 ? "1 pergunta" : `${d.perguntas} perguntas`}: a nota tem poucos degraus.
        </p>
      )}
    </li>
  )
}

function LinhaAlerta({ a }: { a: Alerta }) {
  const Icon = a.severidade === "atencao" ? TriangleAlertIcon : InfoIcon
  return (
    <Alert>
      <Icon />
      <AlertTitle>{a.nome}</AlertTitle>
      <AlertDescription>{a.texto}</AlertDescription>
    </Alert>
  )
}

function Alertas({ relatorio }: { relatorio: Relatorio }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Alertas de coerência</h3>
      {relatorio.alertas.length === 0 ? (
        <Alert>
          <CheckCircle2Icon className="text-success" />
          <AlertTitle>Respostas coerentes</AlertTitle>
          <AlertDescription>{MENSAGEM_COERENCIA}</AlertDescription>
        </Alert>
      ) : (
        <>
          {relatorio.alertas.map((a) => (
            <LinhaAlerta key={a.id} a={a} />
          ))}
          <p className="text-xs text-muted-foreground">
            Os alertas são apenas informativos: não mudam o seu perfil, a sua pontuação nem a distribuição sugerida.
          </p>
        </>
      )}
    </div>
  )
}

function Leitura({ leitura, perfil }: { leitura: EstadoLeitura; perfil: string }) {
  if (leitura.tipo === "carregando") {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando a leitura em texto">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-28 w-full rounded-2xl" />
      </div>
    )
  }
  if (leitura.tipo === "erro") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-bold">Leitura do conjunto</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Não foi possível carregar a leitura em texto agora. Os números acima continuam valendo.</p>
        </CardContent>
      </Card>
    )
  }
  return (
    <Card className="border-l-4 border-l-ai">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-ai-bg text-ai">
            <SparklesIcon />
          </span>
          <CardTitle className="font-bold">Leitura do conjunto</CardTitle>
          <Badge variant="secondary">
            {leitura.origem === "gemini" ? (
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
          <Badge variant="outline">Perfil {perfil}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="leading-relaxed text-foreground">{leitura.texto}</p>
        <CardDescription>
          {leitura.origem === "gemini" ? "Texto gerado pelo Google Gemini a partir dos números acima." : "Texto gerado pelo motor local (modo offline)."}{" "}
          As notas, os alertas e o perfil são calculados pelo sistema, não pela IA.
        </CardDescription>
        {leitura.origem === "fallback" && (
          <Alert>
            <WifiOffIcon />
            <AlertTitle>Modo offline</AlertTitle>
            <AlertDescription>A IA estava indisponível; usamos o texto local para manter a explicação educacional.</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

function Mensagem({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <Alert>
      <InfoIcon />
      <AlertTitle>{titulo}</AlertTitle>
      <AlertDescription>{texto}</AlertDescription>
    </Alert>
  )
}

function Conteudo({ id, answers }: { id: string | null | undefined; answers: Record<string, string> | null | undefined }) {
  const corpo = useMemo(() => corpoDoPedido(id, answers), [id, answers])
  const { relatorio: estado, leitura } = useRelatorio(corpo, true)

  const cabecalho = (
    <div className="flex flex-col gap-1">
      <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight">
        <RadarIcon className="size-5 text-secondary" />
        Seu perfil por dimensão
      </h2>
      <p className="text-sm text-muted-foreground">
        Mostra como as suas respostas se dividem em cinco dimensões e ajuda a entender o porquê do perfil. O perfil continua sendo calculado pelas regras do
        questionário.
      </p>
    </div>
  )

  if (estado.tipo === "carregando") return <SecaoSkeleton />

  if (estado.tipo !== "ok") {
    const mensagem =
      estado.tipo === "indisponivel" && estado.motivo
        ? estado.motivo
        : estado.tipo === "nao-encontrada"
          ? "Não encontramos as respostas desta análise para calcular as dimensões."
          : estado.tipo === "indisponivel"
            ? "As dimensões não estão disponíveis para este resultado. Se quiser vê-las, refaça o questionário."
            : "Não foi possível calcular as dimensões agora. O seu perfil e a distribuição sugerida continuam valendo."
    return (
      <section className="flex flex-col gap-3">
        {cabecalho}
        <Mensagem titulo="Dimensões indisponíveis" texto={mensagem} />
      </section>
    )
  }

  const relatorio = estado.relatorio
  return (
    <section className="flex flex-col gap-5">
      {cabecalho}
      <AvisoReavaliacao relatorio={relatorio} />

      <Card>
        <CardContent className="flex flex-col gap-5">
          <RadarPerfil
            atual={relatorio.dimensoes.map((d) => ({ id: d.id, nome: d.nome, nota: d.nota }))}
            anterior={relatorio.evolucao?.anterior.notas}
            rotuloAtual="Esta análise"
            rotuloAnterior={relatorio.evolucao ? `Análise de ${dataCurta.format(new Date(relatorio.evolucao.anterior.createdAt))}` : undefined}
          />
          <ul className="flex flex-col gap-4">
            {relatorio.dimensoes.map((d) => (
              <LinhaDimensao key={d.id} d={d} />
            ))}
          </ul>
        </CardContent>
      </Card>

      <Alertas relatorio={relatorio} />

      {relatorio.evolucao ? <EvolucaoCard relatorio={relatorio} comRadar={false} /> : <SemEvolucao relatorio={relatorio} />}

      <Leitura leitura={leitura} perfil={relatorio.perfil} />

      <p className="text-xs leading-relaxed text-muted-foreground">{DISCLAIMER}</p>
    </section>
  )
}

/**
 * Seção "Seu perfil por dimensão" do resultado. Busca tudo sozinha e se isola de falhas: se algo der errado, o
 * resultado, a distribuição sugerida e o resto da página continuam normais.
 * `id`: análise guardada na conta (histórico) · `answers`: respostas do resultado atual (anônimo).
 */
export function SecaoDimensoes({ id, answers }: { id?: string | null; answers?: Record<string, string> | null }) {
  return (
    <IsolarFalha>
      <Conteudo id={id} answers={answers} />
    </IsolarFalha>
  )
}
