"use client"

import type { FormEvent, ReactNode } from "react"
import { CalculatorIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { LIMITS, PROFILES } from "@/lib/simulador/premissas"
import type { InputField } from "@/lib/simulador/validacao"
import type { Profile } from "@/lib/suitability/scoring"

export interface FormValues {
  initial: string
  monthly: string
  years: string
  goal: string
  profile: Profile | null
}

export type FormErrors = Partial<Record<InputField | "profile", string>>

interface Props {
  values: FormValues
  errors: FormErrors
  onChange: (next: FormValues) => void
  /** Mostra a escolha do perfil de exemplo (anônimo ou conta sem análise). */
  showProfilePicker: boolean
  busy: boolean
  onSubmit: () => void
}

function FieldBox(props: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={props.id}>{props.label}</Label>
      {props.children}
      {props.error ? (
        <p id={`${props.id}-erro`} role="alert" className="text-sm text-destructive">
          {props.error}
        </p>
      ) : props.hint ? (
        <p id={`${props.id}-dica`} className="text-xs text-muted-foreground">
          {props.hint}
        </p>
      ) : null}
    </div>
  )
}

export function SimuladorForm({ values, errors, onChange, showProfilePicker, busy, onSubmit }: Props) {
  const set = (patch: Partial<FormValues>) => onChange({ ...values, ...patch })
  const fieldProps = (id: InputField) => ({
    id,
    "aria-invalid": errors[id] ? true : undefined,
    "aria-describedby": errors[id] ? `${id}-erro` : `${id}-dica`,
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    onSubmit()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-bold">Sua simulação</CardTitle>
        <CardDescription>Informe os valores em reais. Pode usar 0 em um deles, mas não nos dois.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          {showProfilePicker && (
            <div className="flex flex-col gap-1.5">
              <span id="perfil-rotulo" className="text-sm font-medium">
                Perfil de exemplo
              </span>
              <div role="group" aria-labelledby="perfil-rotulo" className="flex flex-wrap gap-1.5">
                {PROFILES.map((p) => (
                  <Button
                    key={p}
                    type="button"
                    size="sm"
                    variant={values.profile === p ? "default" : "outline"}
                    aria-pressed={values.profile === p}
                    className="cursor-pointer"
                    onClick={() => set({ profile: p })}
                  >
                    {p}
                  </Button>
                ))}
              </div>
              {errors.profile ? (
                <p role="alert" className="text-sm text-destructive">
                  {errors.profile}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Usa a alocação-base do perfil escolhido, só para ilustrar.</p>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldBox id="initial" label="Quanto você já tem para investir hoje (R$)" hint={`Até ${LIMITS.maxInitial.toLocaleString("pt-BR")}. Pode ser 0.`} error={errors.initial}>
              <Input {...fieldProps("initial")} inputMode="decimal" autoComplete="off" placeholder="Ex.: 10.000" value={values.initial} onChange={(e) => set({ initial: e.target.value })} />
            </FieldBox>
            <FieldBox id="monthly" label="Quanto pretende investir por mês (R$)" hint={`Até ${LIMITS.maxMonthly.toLocaleString("pt-BR")}. Pode ser 0.`} error={errors.monthly}>
              <Input {...fieldProps("monthly")} inputMode="decimal" autoComplete="off" placeholder="Ex.: 500" value={values.monthly} onChange={(e) => set({ monthly: e.target.value })} />
            </FieldBox>
            <FieldBox id="years" label="Prazo (anos)" hint={`De ${String(LIMITS.minYears).replace(".", ",")} a ${LIMITS.maxYears} anos, de meio em meio ano.`} error={errors.years}>
              <Input {...fieldProps("years")} inputMode="decimal" autoComplete="off" placeholder="Ex.: 10" value={values.years} onChange={(e) => set({ years: e.target.value })} />
            </FieldBox>
            <FieldBox id="goal" label="Meta de patrimônio (R$) — opcional" hint="Ex.: 100.000. Deixe em branco se não tiver." error={errors.goal}>
              <Input {...fieldProps("goal")} inputMode="decimal" autoComplete="off" placeholder="Ex.: 100.000" value={values.goal} onChange={(e) => set({ goal: e.target.value })} />
            </FieldBox>
          </div>

          <Button type="submit" size="lg" className="w-full cursor-pointer sm:w-fit" disabled={busy}>
            {busy ? <Spinner data-icon="inline-start" /> : <CalculatorIcon data-icon="inline-start" />}
            {busy ? "Calculando…" : "Simular"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
