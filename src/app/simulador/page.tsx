"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { BookmarkIcon, CalculatorIcon, CheckIcon } from "lucide-react"
import { toast } from "sonner"
import { useCurrentUser } from "@/components/auth/use-current-user"
import { LeituraCard } from "@/components/simulador/leitura-card"
import { QuestionnaireHint, ResultadoSimulacao } from "@/components/simulador/resultado-simulacao"
import { SimuladorForm, type FormErrors, type FormValues } from "@/components/simulador/simulador-form"
import type { ReadingView, SimulationView } from "@/components/simulador/tipos"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { fmtDate } from "@/lib/economia/format"
import { parseDecimalPtBR } from "@/lib/simulador/format"
import type { PerfilPendente, PerfilResolvido } from "@/lib/simulador/perfil"
import type { SimulationData } from "@/lib/simulador/servico"

type Contexto = { loggedIn: boolean; perfil: PerfilResolvido | PerfilPendente }

const EMPTY: FormValues = { initial: "", monthly: "", years: "10", goal: "", profile: null }

/**
 * Texto digitado -> número. Vazio vira undefined (o servidor diz o que falta).
 * Ilegível segue como texto, e o servidor responde "deve ser um número".
 */
function num(text: string): number | string | undefined {
  if (text.trim() === "") return undefined
  const n = parseDecimalPtBR(text)
  return Number.isNaN(n) ? text.trim() : n
}

function toView(data: SimulationData): SimulationView {
  return {
    origem: data.perfil.origem,
    profile: data.perfil.profile,
    allocation: data.perfil.allocation,
    rates: data.rates,
    projection: data.projection,
    shortTerm: data.shortTerm,
    estado: data.perfil.estado,
    analysisDate: data.perfil.analysisDate,
    alocacaoBase: data.perfil.alocacaoBase,
  }
}

export default function SimuladorPage() {
  const user = useCurrentUser()
  // undefined = carregando · objeto = de onde vem o perfil (se a consulta falhar, segue como anônimo)
  const [ctx, setCtx] = useState<Contexto | undefined>(undefined)
  const [values, setValues] = useState<FormValues>(EMPTY)
  const [errors, setErrors] = useState<FormErrors>({})
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<SimulationView | null>(null)
  const [reading, setReading] = useState<ReadingView | null | undefined>(undefined)
  const [lastBody, setLastBody] = useState<Record<string, unknown> | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const requestId = useRef(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch("/api/simulador")
        if (!res.ok) throw new Error()
        const data = (await res.json()) as Contexto
        if (!cancelled) setCtx(data)
      } catch {
        if (!cancelled) setCtx({ loggedIn: false, perfil: { estado: "anonimo", pendente: true } })
      }
    }
    void load()
    return () => {
      cancelled = true
    }
    // Recarrega quando o login muda (entrar/sair em outra aba ou no header).
  }, [user?.id])

  const fixedProfile = ctx && !("pendente" in ctx.perfil) ? ctx.perfil : null
  const showPicker = !!ctx && !fixedProfile

  async function simulate() {
    const body: Record<string, unknown> = {
      initial: num(values.initial),
      monthly: num(values.monthly),
      years: num(values.years),
      goal: num(values.goal),
      profile: values.profile ?? undefined,
    }
    const id = ++requestId.current
    setBusy(true)
    setErrors({})
    setSavedId(null)
    try {
      const res = await fetch("/api/simulador", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const data = await res.json()
      if (id !== requestId.current) return
      if (!res.ok) {
        const next: FormErrors = { ...(data.fields ?? {}) }
        if (data.needsProfile) next.profile = data.error
        setErrors(next)
        toast.error(data.error ?? "Não foi possível calcular a simulação.")
        return
      }
      setView(toView(data as SimulationData))
      setLastBody(body)
      setReading(undefined)
      void loadReading(body, id)
    } catch {
      if (id === requestId.current) toast.error("Não foi possível calcular a simulação. Tente de novo em instantes.")
    } finally {
      if (id === requestId.current) setBusy(false)
    }
  }

  async function loadReading(body: Record<string, unknown>, id: number) {
    try {
      const res = await fetch("/api/simulador/leitura", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error()
      const data = (await res.json()) as { reading: string; source: "gemini" | "fallback" }
      if (id !== requestId.current) return
      setReading({ reading: data.reading, source: data.source })
      if (data.source === "fallback") {
        toast.info("Modo offline", { description: "A leitura da simulação foi gerada pelo texto local." })
      }
    } catch {
      if (id === requestId.current) setReading(null)
    }
  }

  async function save() {
    if (!lastBody) return
    setSaving(true)
    try {
      const res = await fetch("/api/simulador/salvas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lastBody) })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Não foi possível salvar a simulação.")
        return
      }
      if (!data.id) {
        toast.error("Não foi possível salvar a simulação agora.", { description: "O resultado continua na tela." })
        return
      }
      setSavedId(data.id as string)
      toast.success("Simulação salva", { description: "Ela aparece em Minhas simulações." })
    } catch {
      toast.error("Não foi possível salvar a simulação agora.", { description: "O resultado continua na tela." })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          <CalculatorIcon className="size-7 text-secondary" />
          Simulador de patrimônio
        </h1>
        <p className="text-muted-foreground">
          Veja como o seu patrimônio poderia evoluir seguindo a alocação do seu perfil, em três cenários hipotéticos. É um exercício educacional, não uma
          previsão.
        </p>
      </header>

      {ctx === undefined ? (
        <Skeleton className="h-72 w-full rounded-2xl" aria-busy="true" aria-label="Carregando simulador" />
      ) : (
        <>
          {fixedProfile && (
            <Alert>
              <CheckIcon />
              <AlertTitle>Usando o seu perfil: {fixedProfile.profile}</AlertTitle>
              <AlertDescription>
                Da análise de {fixedProfile.analysisDate ? fmtDate(fixedProfile.analysisDate) : "sua conta"}, com a mesma alocação que você viu no resultado.{" "}
                <Link href="/minhas-analises" className="underline underline-offset-2">
                  Ver minhas análises
                </Link>
              </AlertDescription>
            </Alert>
          )}
          {showPicker && <QuestionnaireHint />}
          <SimuladorForm values={values} errors={errors} onChange={setValues} showProfilePicker={showPicker} busy={busy} onSubmit={() => void simulate()} />
        </>
      )}

      {view && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            {user ? (
              savedId ? (
                <Button variant="outline" className="cursor-pointer" render={<Link href={`/minhas-simulacoes/${savedId}`} />} nativeButton={false}>
                  <CheckIcon data-icon="inline-start" />
                  Salva · abrir em Minhas simulações
                </Button>
              ) : (
                <Button variant="outline" className="cursor-pointer" disabled={saving} onClick={() => void save()}>
                  <BookmarkIcon data-icon="inline-start" />
                  {saving ? "Salvando…" : "Salvar esta simulação"}
                </Button>
              )
            ) : user === null ? (
              <p className="text-sm text-muted-foreground">
                <Link href="/entrar?next=/simulador" className="font-medium underline underline-offset-2">
                  Entre na sua conta
                </Link>{" "}
                para salvar simulações. Sem conta, o resultado não fica guardado.
              </p>
            ) : null}
          </div>
          <ResultadoSimulacao view={view} reading={<LeituraCard reading={reading} profile={view.profile} />} />
        </>
      )}
    </div>
  )
}
