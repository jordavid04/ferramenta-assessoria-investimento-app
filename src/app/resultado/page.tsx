"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  ResultadoEmpty,
  ResultadoSkeleton,
  ResultadoView,
  type ResultPayload,
} from "@/components/resultado/resultado-view"

export default function ResultadoPage() {
  const [data, setData] = useState<ResultPayload | null | undefined>(undefined)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("investpro:resultado")
      const parsed = raw ? (JSON.parse(raw) as ResultPayload) : null
      setData(parsed)
      if (parsed?.source === "fallback") {
        toast.info("Modo offline", {
          description: "A explicação foi gerada pelo motor local.",
        })
      }
    } catch {
      setData(null)
    }
  }, [])

  if (data === undefined) return <ResultadoSkeleton />
  if (data === null) return <ResultadoEmpty />
  return <ResultadoView data={data} />
}
