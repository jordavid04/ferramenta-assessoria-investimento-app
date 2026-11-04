"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { CircleAlertIcon, LogInIcon } from "lucide-react"
import { toast } from "sonner"
import { notifyAuthChanged } from "@/components/auth/use-current-user"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return "/minhas-analises"
  }
  return raw
}

function EntrarForm() {
  const router = useRouter()
  const search = useSearchParams()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Não foi possível entrar.")
      notifyAuthChanged()
      toast.success("Login feito")
      router.push(safeNext(search.get("next")))
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro inesperado."
      setError(message)
      toast.error(message)
      setLoading(false)
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl font-bold">
          <LogInIcon className="size-6 text-secondary" />
          Entrar
        </CardTitle>
        <CardDescription>
          Use o nome de usuário e a senha da sua conta para ver as análises salvas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="username">Nome de usuário</FieldLabel>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Senha</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <FieldDescription>
                Ainda não tem conta? Ela é criada no fim do{" "}
                <Link href="/suitability">questionário</Link>.
              </FieldDescription>
            </Field>
          </FieldGroup>

          {error && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Não foi possível entrar</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" size="lg" className="cursor-pointer" disabled={loading}>
            {loading ? (
              <>
                <Spinner data-icon="inline-start" />
                Entrando…
              </>
            ) : (
              <>
                <LogInIcon data-icon="inline-start" />
                Entrar
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export default function EntrarPage() {
  return (
    <Suspense fallback={<div className="mx-auto h-64 max-w-md animate-pulse rounded-md bg-muted" />}>
      <EntrarForm />
    </Suspense>
  )
}
