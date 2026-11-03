import Link from "next/link"
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  CompassIcon,
  InfoIcon,
  ListChecksIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export const metadata = { title: "Sobre o projeto — InvestPro" }

const howItWorks = [
  "O perfil é calculado por regras fixas e auditáveis (18 questões, 18 a 72 pontos), nunca pela IA.",
  "A IA apenas explica o perfil e sugere uma alocação, validada contra limites do sistema.",
  "Se a IA estiver indisponível, um motor local assume e o usuário continua atendido.",
  "Não coletamos nome, CPF, e-mail ou renda exata: as respostas são anônimas.",
]

export default function Sobre() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-secondary">
          <InfoIcon className="size-4" />
          Projeto de extensão
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Sobre o InvestPro</h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Educação financeira aplicada: suitability ANBIMA + orientação com IA, pensada para
          investidores iniciantes e servidores públicos.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-bold">
            <InfoIcon className="size-5 text-secondary" />
            O quê
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="leading-relaxed text-foreground">
            O InvestPro é um Projeto de Extensão Universitária II do curso de Bacharelado em Sistemas
            de Informação. Une um formulário de Suitability fundamentado nas regras da ANBIMA à IA
            generativa (Google Gemini) para apoiar quem está dando os primeiros passos em
            investimentos.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-bold">
            <ListChecksIcon className="size-5 text-secondary" />
            Como funciona
          </CardTitle>
          <CardDescription>Transparência do pontuação à explicação.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-3">
            {howItWorks.map((item) => (
              <li
                key={item}
                className="flex gap-3 text-sm leading-relaxed text-foreground sm:text-base"
              >
                <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                {item}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-success">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheckIcon className="text-success" />
            <CardTitle className="text-lg font-bold">Privacidade</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="leading-relaxed text-foreground">
            O MVP não exige cadastro nem guarda dados pessoais identificáveis. Quando o banco está
            disponível, apenas as respostas do questionário e o resultado são persistidos de forma
            anônima.
          </p>
        </CardContent>
      </Card>

      <Alert>
        <TriangleAlertIcon />
        <AlertTitle>Aviso</AlertTitle>
        <AlertDescription>
          Conteúdo exclusivamente educacional. Não é recomendação individualizada de investimento
          nem substitui um profissional certificado.
        </AlertDescription>
      </Alert>

      <Separator />

      <Card className="border border-dashed shadow-none hover:shadow-none">
        <CardContent className="flex flex-wrap items-center gap-3">
          <p className="flex flex-1 items-center gap-2 text-sm text-muted-foreground sm:text-base">
            <CompassIcon className="size-4 shrink-0 text-primary" />
            Quer ver na prática? Faça o questionário agora.
          </p>
          <Button
            size="lg"
            className="cursor-pointer"
            render={<Link href="/suitability" />}
            nativeButton={false}
          >
            Descobrir meu perfil
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
