"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ClipboardListIcon, HistoryIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"

type SessionSummary = {
  id: string
  createdAt: string
  score: number
  profile: string
}

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" })

export default function MinhasAnalisesPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<SessionSummary[] | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await fetch("/api/suitability")
      if (res.status === 401) {
        router.replace("/entrar?next=/minhas-analises")
        return
      }
      if (!res.ok) {
        if (!cancelled) setSessions(null)
        return
      }
      const data = (await res.json()) as { sessions: SessionSummary[] }
      if (!cancelled) setSessions(data.sessions)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [router])

  if (sessions === undefined) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando análises">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    )
  }

  if (sessions === null) {
    return (
      <Empty className="border border-dashed py-12">
        <EmptyHeader>
          <EmptyTitle>Não foi possível carregar</EmptyTitle>
          <EmptyDescription>Tente de novo em instantes. O banco pode estar indisponível.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          <HistoryIcon className="size-7 text-secondary" />
          Minhas análises
        </h1>
        <p className="text-muted-foreground">Resultados salvos na sua conta.</p>
      </header>

      {sessions.length === 0 ? (
        <Empty className="border border-dashed py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ClipboardListIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhuma análise ainda</EmptyTitle>
            <EmptyDescription>
              Responda o questionário estando logado para guardar o resultado aqui.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              size="lg"
              className="cursor-pointer"
              render={<Link href="/suitability" />}
              nativeButton={false}
            >
              <ClipboardListIcon data-icon="inline-start" />
              Descobrir meu perfil
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {sessions.map((session) => (
            <li key={session.id}>
              <Link href={`/resultado/${session.id}`} className="block cursor-pointer">
                <Card className="transition-colors duration-200 hover:bg-muted/40">
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="font-bold">{session.profile}</CardTitle>
                      <Badge variant="secondary">{session.score} de 72</Badge>
                    </div>
                    <CardDescription>
                      {dateFormat.format(new Date(session.createdAt))}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">Abrir resultado</CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
