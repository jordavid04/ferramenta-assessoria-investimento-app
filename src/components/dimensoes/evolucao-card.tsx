import Link from "next/link"
import { ArrowDownRightIcon, ArrowUpRightIcon, EqualIcon, InfoIcon, RotateCcwIcon, TrendingUpIcon, UserRoundPlusIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Relatorio, VariacaoDimensao } from "@/lib/dimensoes/tipos"
import { RadarPerfil } from "./radar-perfil"

const dataCurta = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" })

/** Aviso discreto: a análise mais recente da conta tem mais de 12 meses. Só aparece quando o servidor manda `reavaliacao`. */
export function AvisoReavaliacao({ relatorio }: { relatorio: Relatorio }) {
  if (!relatorio.reavaliacao) return null
  return (
    <Alert>
      <RotateCcwIcon />
      <AlertTitle>Sua última análise tem mais de 12 meses</AlertTitle>
      <AlertDescription>
        <p>
          Ela foi feita em {dataCurta.format(new Date(relatorio.reavaliacao.ultimaAnalise))}. Sua situação pode ter mudado desde então: vale refazer o
          questionário para atualizar o seu perfil.
        </p>
        <Button size="sm" variant="outline" className="mt-2 cursor-pointer" render={<Link href="/suitability" />} nativeButton={false}>
          <RotateCcwIcon data-icon="inline-start" />
          Refazer questionário
        </Button>
      </AlertDescription>
    </Alert>
  )
}

const SENTIDO = {
  subiu: { Icon: ArrowUpRightIcon, texto: "subiu", classe: "text-success" },
  caiu: { Icon: ArrowDownRightIcon, texto: "caiu", classe: "text-primary" },
  estavel: { Icon: EqualIcon, texto: "estável", classe: "text-muted-foreground" },
} as const

function LinhaVariacao({ v }: { v: VariacaoDimensao }) {
  const { Icon, texto, classe } = SENTIDO[v.sentido]
  return (
    <li className="flex items-center justify-between gap-3 text-sm">
      <span className="flex items-center gap-2">
        <Icon className={`size-4 shrink-0 ${classe}`} aria-hidden="true" />
        {v.nome}
      </span>
      <span className="text-muted-foreground">
        <span className="font-medium text-foreground">{texto}</span>
        {v.sentido === "estavel" ? "" : ` ${Math.abs(v.delta)} p.p.`} · {v.de}% → {v.para}%
      </span>
    </li>
  )
}

/** Mensagem quando não há com o que comparar. */
export function SemEvolucao({ relatorio }: { relatorio: Relatorio }) {
  switch (relatorio.motivoSemEvolucao) {
    case "anonimo":
      return (
        <Alert>
          <UserRoundPlusIcon />
          <AlertTitle>Quer acompanhar sua evolução?</AlertTitle>
          <AlertDescription>
            <p>
              Crie uma conta para guardar as suas análises e ver como as dimensões mudam ao longo do tempo. Sem conta, você vê apenas o resultado
              atual.
            </p>
            <Button size="sm" variant="outline" className="mt-2 cursor-pointer" render={<Link href="/entrar" />} nativeButton={false}>
              <UserRoundPlusIcon data-icon="inline-start" />
              Criar conta ou entrar
            </Button>
          </AlertDescription>
        </Alert>
      )
    case "primeira-analise":
      return (
        <Alert>
          <TrendingUpIcon />
          <AlertTitle>Esta é a sua primeira análise</AlertTitle>
          <AlertDescription>Refaça o questionário mais adiante para comparar e ver como as dimensões evoluem.</AlertDescription>
        </Alert>
      )
    case "versao-diferente":
      return (
        <Alert>
          <InfoIcon />
          <AlertTitle>Sem comparação com a análise anterior</AlertTitle>
          <AlertDescription>As perguntas mudaram desde a análise anterior, então as dimensões não são comparáveis.</AlertDescription>
        </Alert>
      )
    case "indisponivel":
      return (
        <Alert>
          <InfoIcon />
          <AlertTitle>Comparação indisponível</AlertTitle>
          <AlertDescription>Não foi possível comparar com a análise anterior agora. O resultado desta análise continua valendo.</AlertDescription>
        </Alert>
      )
    default:
      return null
  }
}

/** Radar atual sobreposto ao da análise anterior + "o que mudou". Sem evolução, mostra o motivo. */
export function EvolucaoCard({
  relatorio,
  titulo = "Como seu perfil mudou",
  comRadar = true,
}: {
  relatorio: Relatorio
  titulo?: string
  /** false quando o radar sobreposto já aparece em outro ponto da página. */
  comRadar?: boolean
}) {
  const ev = relatorio.evolucao
  if (!ev) return <SemEvolucao relatorio={relatorio} />

  const dataAnterior = dataCurta.format(new Date(ev.anterior.createdAt))
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 font-bold">
          <TrendingUpIcon className="size-5 text-secondary" />
          {titulo}
        </CardTitle>
        <CardDescription>
          Comparação com a análise de {dataAnterior} ({ev.anterior.pontuacao} de 72 pontos, perfil {ev.anterior.perfil}). A variação só aparece como
          subida ou queda a partir de 10 pontos percentuais (p.p.).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {comRadar && (
          <RadarPerfil
            atual={relatorio.dimensoes.map((d) => ({ id: d.id, nome: d.nome, nota: d.nota }))}
            anterior={ev.anterior.notas}
            rotuloAtual="Esta análise"
            rotuloAnterior={`Análise de ${dataAnterior}`}
          />
        )}
        <p className="text-sm leading-relaxed text-foreground">{ev.resumo}</p>
        <ul className="flex flex-col gap-2 border-t border-border pt-3">
          {ev.variacoes.map((v) => (
            <LinhaVariacao key={v.id} v={v} />
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
