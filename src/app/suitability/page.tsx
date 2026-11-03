"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import {
  AlertTriangleIcon,
  BookOpenIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  ClipboardListIcon,
  FileCheckIcon,
  GaugeIcon,
  SendIcon,
  TargetIcon,
  WalletIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Spinner } from "@/components/ui/spinner"
import { GROUPS, QUESTIONS, type OptionKey, type Question } from "@/lib/suitability/questions"

const ORDER = ["situacao", "objetivos", "conhecimento", "tolerancia"] as const

const STEP_ICONS = {
  situacao: WalletIcon,
  objetivos: TargetIcon,
  conhecimento: BookOpenIcon,
  tolerancia: GaugeIcon,
} as const

const STEPS = ORDER.map((g) => ({
  key: g,
  icon: STEP_ICONS[g],
  ...GROUPS[g],
  questions: QUESTIONS.filter((q) => q.group === g),
}))

export default function SuitabilityPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<number, OptionKey>>({})
  const [accepted, setAccepted] = useState({ terms: false, risk: false })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const current = STEPS[step]
  const StepIcon = current.icon
  const isLast = step === STEPS.length - 1
  const answered = Object.keys(answers).length
  const stepDone = useMemo(
    () => current.questions.every((q) => answers[q.id]),
    [current, answers],
  )
  const canSubmit = stepDone && accepted.terms && accepted.risk
  const progress = (answered / QUESTIONS.length) * 100

  async function submit() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/suitability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, acceptedTerms: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Não foi possível gerar o resultado.")
      try {
        sessionStorage.setItem("investpro:resultado", JSON.stringify(data))
      } catch {
        /* modo privado */
      }
      toast.success("Perfil calculado com sucesso")
      router.push("/resultado")
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro inesperado."
      setError(message)
      toast.error(message)
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        <Card className="hidden lg:flex">
          <CardHeader>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <ClipboardListIcon className="size-3.5" />
              Formulário de Suitability
            </p>
            <CardTitle className="sr-only">Etapas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ol className="flex flex-col gap-2">
              {STEPS.map((s, i) => {
                const state = i === step ? "current" : i < step ? "done" : "todo"
                const Icon = s.icon
                return (
                  <li
                    key={s.key}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors duration-200 ${
                      state === "current"
                        ? "bg-secondary font-semibold text-secondary-foreground"
                        : state === "done"
                          ? "bg-secondary/10 font-medium text-secondary"
                          : "text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`inline-flex size-5 items-center justify-center rounded-full text-xs ${
                        state === "current"
                          ? "bg-white/20"
                          : state === "done"
                            ? "bg-secondary text-secondary-foreground"
                            : "bg-muted"
                      }`}
                    >
                      {state === "done" ? <CheckIcon className="size-3" /> : <Icon className="size-3" />}
                    </span>
                    {s.title}
                  </li>
                )
              })}
            </ol>
            <Progress value={progress} className="w-full">
              <ProgressLabel className="text-xs text-muted-foreground">
                {answered} de {QUESTIONS.length} respondidas
              </ProgressLabel>
              <ProgressValue className="text-xs" />
            </Progress>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 lg:hidden">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="secondary">
              <StepIcon data-icon="inline-start" />
              Etapa {step + 1} de {STEPS.length}
            </Badge>
            <p className="text-xs text-muted-foreground">
              {answered}/{QUESTIONS.length}
            </p>
          </div>
          <div className="flex gap-1.5" aria-label="Etapas">
            {STEPS.map((s, i) => (
              <div
                key={s.key}
                className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${
                  i <= step ? "bg-primary" : "bg-muted"
                }`}
                title={s.title}
              />
            ))}
          </div>
          <Progress value={progress} className="w-full" />
        </div>
      </aside>

      <section className="flex flex-col gap-5">
        <header className="flex flex-col gap-1">
          <p className="hidden text-sm font-medium text-muted-foreground lg:block">
            Etapa {step + 1} de {STEPS.length}
          </p>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            <StepIcon className="size-7 shrink-0 text-secondary" />
            {current.title}
          </h1>
          <p className="text-muted-foreground">{current.hint}</p>
        </header>

        <FieldGroup>
          {current.questions.map((q) => (
            <QuestionCard
              key={q.id}
              q={q}
              value={answers[q.id]}
              onChange={(k) => setAnswers((a) => ({ ...a, [q.id]: k }))}
            />
          ))}
        </FieldGroup>

        {isLast && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <FileCheckIcon className="size-3.5" />
                Aceite dos termos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field orientation="horizontal" className="items-start rounded-xl border border-border p-3">
                  <Checkbox
                    id="terms"
                    checked={accepted.terms}
                    onCheckedChange={(checked) =>
                      setAccepted((a) => ({ ...a, terms: checked === true }))
                    }
                  />
                  <FieldLabel htmlFor="terms" className="cursor-pointer font-normal">
                    <span className="flex items-start gap-2">
                      <FileCheckIcon className="mt-0.5 size-4 shrink-0 text-secondary" />
                      <span>
                        Li e aceito que o resultado é <strong>conteúdo educacional</strong> e não
                        constitui recomendação individualizada de investimento.
                      </span>
                    </span>
                  </FieldLabel>
                </Field>
                <Field orientation="horizontal" className="items-start rounded-xl border border-border p-3">
                  <Checkbox
                    id="risk"
                    checked={accepted.risk}
                    onCheckedChange={(checked) =>
                      setAccepted((a) => ({ ...a, risk: checked === true }))
                    }
                  />
                  <FieldLabel htmlFor="risk" className="cursor-pointer font-normal">
                    <span className="flex items-start gap-2">
                      <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>
                        Estou ciente de que investimentos envolvem riscos e posso ter perdas.
                      </span>
                    </span>
                  </FieldLabel>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        )}

        {error && (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>Não foi possível continuar</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap gap-3 pt-1">
          <Button
            variant="outline"
            size="lg"
            className="cursor-pointer"
            disabled={step === 0 || loading}
            onClick={() => setStep((s) => s - 1)}
          >
            <ChevronLeftIcon data-icon="inline-start" />
            Voltar
          </Button>
          {isLast ? (
            <Button
              size="lg"
              className="cursor-pointer"
              disabled={!canSubmit || loading}
              onClick={submit}
            >
              {loading ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Gerando seu resultado…
                </>
              ) : (
                <>
                  <SendIcon data-icon="inline-start" />
                  Ver meu perfil
                </>
              )}
            </Button>
          ) : (
            <Button
              size="lg"
              className="cursor-pointer"
              disabled={!stepDone}
              onClick={() => {
                setStep((s) => s + 1)
                window.scrollTo({ top: 0, behavior: "smooth" })
              }}
            >
              Próxima etapa
              <ChevronRightIcon data-icon="inline-end" />
            </Button>
          )}
        </div>
      </section>
    </div>
  )
}

function QuestionCard({
  q,
  value,
  onChange,
}: {
  q: Question
  value?: OptionKey
  onChange: (k: OptionKey) => void
}) {
  return (
    <Card>
      <CardContent>
        <FieldSet>
          <FieldLegend className="font-bold text-foreground">
            {q.id}. {q.text}
          </FieldLegend>
          <RadioGroup
            value={value ?? ""}
            onValueChange={(v) => onChange(v as OptionKey)}
            className="flex flex-col gap-2"
          >
            {(Object.entries(q.options) as [OptionKey, string][]).map(([k, label]) => {
              const id = `q${q.id}-${k}`
              return (
                <FieldLabel
                  key={k}
                  htmlFor={id}
                  className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl border border-border px-4 py-3 font-normal transition-colors duration-200 hover:bg-muted/50 has-data-checked:border-primary has-data-checked:bg-primary/5"
                >
                  <Field orientation="horizontal" className="w-full items-center gap-3">
                    <RadioGroupItem value={k} id={id} />
                    <FieldTitle className="text-sm font-normal">
                      <span className="mr-1.5 font-semibold text-secondary">{k})</span>
                      {label}
                    </FieldTitle>
                  </Field>
                </FieldLabel>
              )
            })}
          </RadioGroup>
        </FieldSet>
      </CardContent>
    </Card>
  )
}
