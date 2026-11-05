import type { ReactNode } from "react"
import Link from "next/link"
import { ClipboardListIcon, InfoIcon, RotateCcwIcon, TargetIcon, TrendingDownIcon, TriangleAlertIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { fmtBRL, fmtDate, fmtDayMonth, fmtMonthYear, fmtNumber, fmtPercent } from "@/lib/economia/format"
import { fmtMonths, fmtYears, SIMULATION_DISCLAIMER } from "@/lib/simulador/format"
import { CLASSES, RATE_RULES, SCENARIO_LABEL, SCENARIOS, type Scenario } from "@/lib/simulador/premissas"
import { EvolucaoChart } from "./evolucao-chart"
import type { SimulationView } from "./tipos"

/* ------------------------------ Avisos ------------------------------ */

function Notices({ view }: { view: SimulationView }) {
  const { rates } = view
  return (
    <div className="flex flex-col gap-3">
      {view.origem === "exemplo" && (
        <Alert>
          <InfoIcon />
          <AlertTitle>Simulação ilustrativa</AlertTitle>
          <AlertDescription>
            Esta simulação usa o perfil de exemplo {view.profile} e a alocação-base dele. Ela não é o perfil calculado para você.
            {view.estado === "anonimo" || view.estado === "sem-analise" ? " Responda o questionário para simular com o seu perfil." : ""}
          </AlertDescription>
        </Alert>
      )}

      {view.estado === "perfil-antigo" && (
        <Alert>
          <RotateCcwIcon />
          <AlertTitle>Seu perfil tem mais de 12 meses</AlertTitle>
          <AlertDescription>
            <p>
              A simulação usa o perfil {view.profile}, da análise de {view.analysisDate ? fmtDate(view.analysisDate) : "mais de um ano atrás"}. Sua
              situação pode ter mudado: vale refazer o questionário.
            </p>
            <Button size="sm" variant="outline" className="mt-2 cursor-pointer" render={<Link href="/suitability" />} nativeButton={false}>
              <RotateCcwIcon data-icon="inline-start" />
              Refazer questionário
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {view.alocacaoBase && (
        <Alert>
          <InfoIcon />
          <AlertTitle>Alocação-base do perfil</AlertTitle>
          <AlertDescription>
            Não foi possível ler a alocação gravada na sua análise, então usamos a alocação-base do perfil {view.profile}.
          </AlertDescription>
        </Alert>
      )}

      {view.shortTerm && (
        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>Prazo muito curto</AlertTitle>
          <AlertDescription>
            Com menos de 1 ano, a simulação é pouco representativa: no curto prazo os resultados oscilam muito e dependem de fatores que este modelo não
            captura.
          </AlertDescription>
        </Alert>
      )}

      {rates.origem === "cache" && rates.atualizadoEm && (
        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>Dados atualizados em {fmtDayMonth(rates.atualizadoEm)}</AlertTitle>
          <AlertDescription>Não conseguimos consultar o Banco Central agora, então usamos o último dado guardado de CDI e inflação.</AlertDescription>
        </Alert>
      )}

      {rates.origem === "referencia" && (
        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>Valores de referência aproximados</AlertTitle>
          <AlertDescription>
            {rates.referencia.cdi && rates.referencia.ipca12m
              ? "Não foi possível consultar o Banco Central e não há dado guardado, então usamos valores de referência do sistema para o CDI e a inflação."
              : `Não foi possível obter ${rates.referencia.cdi ? "o CDI" : "a inflação"}, então usamos um valor de referência do sistema para ${rates.referencia.cdi ? "ele" : "ela"}.`}{" "}
            Eles são aproximados: o resultado é só uma ilustração.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

/* ------------------------- Resumo dos cenários ------------------------- */

const TONE: Record<Scenario, string> = {
  pessimista: "border-t-destructive",
  base: "border-t-chart-1",
  otimista: "border-t-chart-2",
}

function Row({ label, value, emphasis, danger }: { label: string; value: string; emphasis?: boolean; danger?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`text-right font-mono tabular-nums ${emphasis ? "text-lg font-bold" : "font-medium"} ${danger ? "text-destructive" : ""}`}>{value}</dd>
    </div>
  )
}

function ScenarioCard({ view, scenario }: { view: SimulationView; scenario: Scenario }) {
  const { projection } = view
  const r = projection.scenarios[scenario]
  return (
    <Card className={`border-t-4 ${TONE[scenario]}`}>
      <CardHeader>
        <CardTitle className="font-bold">Cenário {SCENARIO_LABEL[scenario].toLowerCase()}</CardTitle>
        <CardDescription>Valor final hipotético, bruto</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <dl className="flex flex-col gap-2 text-sm">
          <Row label="Você investiu" value={fmtBRL(projection.invested)} />
          <Row label="Valor final hipotético" value={fmtBRL(r.finalValue)} emphasis />
          <Row
            label={r.earnings < 0 ? "Perda hipotética" : "Rendimento hipotético"}
            value={r.earnings < 0 ? `− ${fmtBRL(Math.abs(r.earnings))}` : fmtBRL(r.earnings)}
            danger={r.earnings < 0}
          />
          <Row label="Em poder de compra de hoje" value={fmtBRL(r.realValue)} />
        </dl>
        {r.belowInvested && (
          <p className="flex items-start gap-1.5 rounded-md bg-destructive/10 p-2 text-xs font-medium text-destructive">
            <TrendingDownIcon className="mt-0.5 size-3.5 shrink-0" />
            Neste cenário o valor final ficaria abaixo do que você investiu: perdas são possíveis.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

/* ------------------- Comparação com a inflação e meta ------------------- */

function InflationComparison({ view }: { view: SimulationView }) {
  const { projection } = view
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-bold">Comparação com apenas acompanhar a inflação</CardTitle>
        <CardDescription>
          Para manter o poder de compra, o dinheiro que você colocou precisaria chegar a{" "}
          <strong className="text-foreground">{fmtBRL(projection.inflationValue)}</strong> ao final de {fmtYears(projection.months / 12)} (inflação de{" "}
          {fmtPercent(projection.rates.ipca12m)} ao ano).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-3 sm:grid-cols-3">
          {SCENARIOS.map((s) => {
            const diff = projection.scenarios[s].vsInflation
            return (
              <li key={s} className="flex flex-col gap-0.5 rounded-lg border p-3 text-sm">
                <span className="font-semibold">{SCENARIO_LABEL[s]}</span>
                <span className={`font-mono text-base font-bold tabular-nums ${diff < 0 ? "text-destructive" : "text-success"}`}>
                  {diff < 0 ? "− " : "+ "}
                  {fmtBRL(Math.abs(diff))}
                </span>
                <span className="text-xs text-muted-foreground">{diff < 0 ? "abaixo da inflação" : "acima da inflação"}</span>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

function GoalSection({ view }: { view: SimulationView }) {
  const { projection } = view
  if (projection.input.goal === null) return null
  const aloneReaches = projection.scenarios.base.goal?.investedAloneReaches
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-bold">
          <TargetIcon className="size-5 text-secondary" />
          Sua meta: {fmtBRL(projection.input.goal)}
        </CardTitle>
        {aloneReaches && (
          <CardDescription>
            Só com o que você investiria (sem nenhum rendimento) a meta já seria alcançada dentro do prazo. Os rendimentos, quando existem, apenas
            antecipam esse momento.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <ul className="grid gap-3 sm:grid-cols-3">
          {SCENARIOS.map((s) => {
            const g = projection.scenarios[s].goal!
            return (
              <li key={s} className="flex flex-col gap-0.5 rounded-lg border p-3 text-sm">
                <span className="font-semibold">{SCENARIO_LABEL[s]}</span>
                {g.reached ? (
                  <>
                    <span className="font-bold text-success">Atingida</span>
                    <span className="text-xs text-muted-foreground">{g.month === 0 ? "já no início" : `em ${fmtMonths(g.month!)}`}</span>
                  </>
                ) : (
                  <>
                    <span className="font-bold text-destructive">Não atingida</span>
                    <span className="text-xs text-muted-foreground">faltariam {fmtBRL(g.shortfall)} ao final do prazo</span>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

/* ------------------------------ Premissas ------------------------------ */

function ruleText(c: (typeof CLASSES)[number], s: Scenario): string {
  const rule = RATE_RULES[c]
  if (rule.kind === "cdi") return `${fmtNumber(rule.percentOfCdi[s], 0)}% do CDI`
  const p = rule.premium[s]
  return `inflação ${p < 0 ? "−" : "+"} ${fmtNumber(Math.abs(p), 1)} p.p.`
}

function Assumptions({ view }: { view: SimulationView }) {
  const { projection, rates } = view
  const percentOf = (c: (typeof CLASSES)[number]) => view.allocation.find((a) => a.assetClass === c)?.percent ?? 0
  const classes = CLASSES.filter((c) => percentOf(c) > 0)

  const source =
    rates.origem === "referencia"
      ? "valores de referência do sistema (aproximados)"
      : `dados abertos do Banco Central${rates.cdiDate ? `, CDI de ${fmtDate(rates.cdiDate)}` : ""}${rates.ipcaDate ? ` e IPCA de ${fmtMonthYear(rates.ipcaDate)}` : ""}${rates.atualizadoEm ? `, consultados em ${fmtDate(rates.atualizadoEm)}` : ""}`

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-bold">Premissas usadas</CardTitle>
        <CardDescription>
          São hipóteses didáticas, não previsões nem promessas. Valores brutos: sem impostos, taxas de administração ou corretagem.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <p className="leading-relaxed">
          <strong>CDI atual:</strong> {fmtPercent(projection.rates.cdi)} ao ano · <strong>Inflação atual (IPCA em 12 meses):</strong>{" "}
          {fmtPercent(projection.rates.ipca12m)} ao ano. Origem: {source}.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-136 border-collapse text-left">
            <caption className="sr-only">Taxa anual hipotética de cada classe em cada cenário</caption>
            <thead>
              <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-semibold">Classe</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Na carteira</th>
                {SCENARIOS.map((s) => (
                  <th key={s} scope="col" className="py-2 pr-3 font-semibold">{SCENARIO_LABEL[s]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c} className="border-b last:border-0 align-top">
                  <th scope="row" className="py-2 pr-3 font-medium">{c}</th>
                  <td className="py-2 pr-3 tabular-nums">{percentOf(c)}%</td>
                  {SCENARIOS.map((s) => {
                    const rate = projection.scenarios[s].classRates[c]
                    return (
                      <td key={s} className="py-2 pr-3">
                        <span className={`font-mono font-medium tabular-nums ${rate < 0 ? "text-destructive" : ""}`}>{fmtPercent(rate)}</span>
                        <span className="block text-xs text-muted-foreground">{ruleText(c, s)}</span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Renda fixa e fundos acompanham o CDI. Fundos imobiliários, ETFs e ações acompanham a inflação mais um prêmio, com variação maior entre os
          cenários. O dinheiro é dividido entre as classes pela alocação do perfil, sem rebalanceamento; os aportes mensais entram no fim de cada mês.
          Com juros altos, as classes de maior risco podem render menos que a renda fixa nas hipóteses: mais risco não significa, por si só, mais retorno.
        </p>
      </CardContent>
    </Card>
  )
}

/* ------------------------------ Conjunto ------------------------------ */

export function ProfileSummary({ view }: { view: SimulationView }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Badge variant={view.origem === "analise" ? "secondary" : "outline"}>
        {view.origem === "analise" ? `Seu perfil: ${view.profile}` : `Perfil de exemplo: ${view.profile}`}
      </Badge>
      {view.allocation
        .filter((a) => a.percent > 0)
        .map((a) => (
          <Badge key={a.assetClass} variant="outline">
            {a.assetClass} {a.percent}%
          </Badge>
        ))}
    </div>
  )
}

/** Tudo da simulação, na ordem da especificação. `reading` entra entre a comparação/meta e as premissas. */
export function ResultadoSimulacao({ view, reading }: { view: SimulationView; reading: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <Notices view={view} />
      <ProfileSummary view={view} />

      <section aria-label="Resumo dos três cenários" className="grid gap-4 md:grid-cols-3">
        {SCENARIOS.map((s) => (
          <ScenarioCard key={s} view={view} scenario={s} />
        ))}
      </section>

      <EvolucaoChart projection={view.projection} />
      <InflationComparison view={view} />
      <GoalSection view={view} />
      {reading}
      <Assumptions view={view} />

      <Alert>
        <InfoIcon />
        <AlertTitle>Aviso importante</AlertTitle>
        <AlertDescription>{SIMULATION_DISCLAIMER}</AlertDescription>
      </Alert>
    </div>
  )
}

export function QuestionnaireHint() {
  return (
    <Alert>
      <ClipboardListIcon />
      <AlertTitle>Quer simular com o seu perfil?</AlertTitle>
      <AlertDescription>
        <p>Responda o questionário (leva poucos minutos) e a simulação passa a usar a alocação do seu perfil.</p>
        <Button size="sm" className="mt-2 cursor-pointer" render={<Link href="/suitability" />} nativeButton={false}>
          <ClipboardListIcon data-icon="inline-start" />
          Responder o questionário
        </Button>
      </AlertDescription>
    </Alert>
  )
}
