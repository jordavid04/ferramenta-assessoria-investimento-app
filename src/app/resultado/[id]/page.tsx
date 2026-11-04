"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ResultadoEmpty,
  ResultadoSkeleton,
  ResultadoView,
  type ResultPayload,
} from "@/components/resultado/resultado-view"

export default function ResultadoSalvoPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<ResultPayload | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await fetch(`/api/suitability/${params.id}`)
      if (res.status === 401) {
        router.replace(`/entrar?next=${encodeURIComponent(`/resultado/${params.id}`)}`)
        return
      }
      if (!res.ok) {
        if (!cancelled) setData(null)
        return
      }
      const parsed = (await res.json()) as ResultPayload
      if (cancelled) return
      setData(parsed)
      if (parsed.source === "fallback") {
        toast.info("Modo offline", {
          description: "A explicação foi gerada pelo motor local.",
        })
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [params.id, router])

  if (data === undefined) return <ResultadoSkeleton />
  if (data === null) {
    return (
      <ResultadoEmpty
        title="Análise não encontrada"
        description="Essa análise não está na sua conta. Ela pode ser anônima ou de outro usuário."
      />
    )
  }
  return <ResultadoView data={data} />
}
