import Link from "next/link"
import {
  ArrowRightIcon,
  ChartColumnIcon,
  ClipboardListIcon,
  ClockIcon,
  CompassIcon,
  ListOrderedIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UsersIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const steps = [
  {
    icon: ClipboardListIcon,
    t: "Responda 18 questões",
    d: "Questionário de Suitability baseado nas regras da ANBIMA, em 4 etapas curtas.",
  },
  {
    icon: ChartColumnIcon,
    t: "Receba seu perfil",
    d: "Conservador, Moderado, Arrojado ou Agressivo — calculado de forma transparente.",
  },
  {
    icon: SparklesIcon,
    t: "Entenda com a IA",
    d: "O Google Gemini explica seu perfil e sugere uma alocação por classe de ativo.",
  },
]

const trust = [
  { icon: ShieldCheckIcon, label: "Regras ANBIMA", detail: "Perfil por pontuação auditável" },
  { icon: UsersIcon, label: "Sem cadastro", detail: "Respostas anônimas" },
  { icon: ClockIcon, label: "Cerca de 5 minutos", detail: "Comece e termine no mesmo fluxo" },
]

export default function Home() {
  return (
    <div className="flex flex-col gap-12 sm:gap-16">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-nav via-secondary to-slate-700 px-6 py-10 text-white shadow-sm sm:px-10 sm:py-14">
        <div className="relative max-w-2xl">
          <Badge variant="outline" className="border-amber-200/40 bg-white/10 text-amber-100">
            <CompassIcon data-icon="inline-start" />
            InvestPro
          </Badge>
          <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-[2.75rem]">
            Descubra seu perfil de investidor e organize seu primeiro passo.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-200 sm:text-lg">
            Ferramenta gratuita para servidores públicos e investidores iniciantes. Sem cadastro e sem
            dados pessoais.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              className="cursor-pointer"
              render={<Link href="/suitability" />}
              nativeButton={false}
            >
              Começar o questionário
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="cursor-pointer text-white/90 hover:bg-white/10 hover:text-white"
              render={<a href="#como-funciona" />}
              nativeButton={false}
            >
              <ListOrderedIcon data-icon="inline-start" />
              Como funciona
            </Button>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="flex scroll-mt-8 flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ListOrderedIcon className="size-6 text-secondary" />
            Como funciona
          </h2>
          <p className="text-muted-foreground">Três passos claros até a orientação educacional.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {steps.map((s, i) => {
            const Icon = s.icon
            return (
              <Card key={s.t} className="h-full">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-md bg-secondary/10 text-secondary">
                      <Icon />
                    </span>
                    <Badge variant="secondary">Passo {i + 1}</Badge>
                  </div>
                  <CardTitle className="mt-2 text-base font-bold">{s.t}</CardTitle>
                  <CardDescription className="leading-relaxed">{s.d}</CardDescription>
                </CardHeader>
              </Card>
            )
          })}
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ShieldCheckIcon className="size-6 text-secondary" />
            Por que confiar no processo
          </h2>
          <p className="text-muted-foreground">
            Educação financeira com regras claras e privacidade em primeiro lugar.
          </p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-3">
          {trust.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.label} className="flex gap-3 rounded-md bg-card p-4 shadow-[0_8px_30px_rgba(15,23,42,0.12)]">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-secondary">
                  <Icon />
                </span>
                <div className="flex flex-col gap-0.5">
                  <p className="font-semibold">{item.label}</p>
                  <p className="text-sm text-muted-foreground">{item.detail}</p>
                </div>
              </li>
            )
          })}
        </ul>
        <Card className="border border-dashed shadow-none hover:shadow-none">
          <CardContent className="flex flex-wrap items-center gap-3">
            <p className="flex flex-1 items-center gap-2 text-sm text-muted-foreground sm:text-base">
              <CompassIcon className="size-4 shrink-0 text-primary" />
              Pronto para descobrir seu perfil? O questionário leva poucos minutos.
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
      </section>
    </div>
  )
}
