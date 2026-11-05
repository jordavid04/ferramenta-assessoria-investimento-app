"use client"

import { useEffect, useState } from "react"
import type { Relatorio } from "@/lib/dimensoes/tipos"

export type EstadoRelatorio =
  | { tipo: "carregando" }
  | { tipo: "ok"; relatorio: Relatorio }
  /** A análise existe, mas as dimensões não podem ser mostradas (respostas incompletas, banco fora do ar). */
  | { tipo: "indisponivel"; motivo: string }
  | { tipo: "nao-encontrada" }
  | { tipo: "erro" }

export type EstadoLeitura =
  | { tipo: "carregando" }
  | { tipo: "ok"; texto: string; origem: "gemini" | "fallback" }
  | { tipo: "erro" }

/** Corpo do pedido: o id da análise e/ou as respostas do resultado atual. */
export function corpoDoPedido(id: string | null | undefined, answers: Record<string, string> | null | undefined): string | null {
  if (!id && !answers) return null
  return JSON.stringify({ ...(id ? { id } : {}), ...(answers ? { answers } : {}) })
}

async function postar(url: string, corpo: string): Promise<{ status: number; json: unknown }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: corpo })
  let json: unknown = null
  try {
    json = await res.json()
  } catch {
    /* corpo vazio ou inválido: tratado como erro por quem chama */
  }
  return { status: res.status, json }
}

/**
 * Busca o relatório das dimensões e, depois dele, a leitura em texto (a IA nunca atrasa os números).
 * Qualquer falha vira um estado, nunca uma exceção: o resto da página não é afetado.
 */
export function useRelatorio(corpo: string | null, comLeitura: boolean) {
  const [relatorio, setRelatorio] = useState<EstadoRelatorio>({ tipo: "carregando" })
  const [leitura, setLeitura] = useState<EstadoLeitura>({ tipo: "carregando" })

  useEffect(() => {
    if (corpo === null) return
    let cancelado = false
    setRelatorio({ tipo: "carregando" })
    setLeitura({ tipo: "carregando" })

    async function carregar(pedido: string) {
      try {
        const { status, json } = await postar("/api/dimensoes", pedido)
        if (cancelado) return
        const dados = json as { status?: string; relatorio?: Relatorio; motivo?: string } | null
        if (status === 404) return setRelatorio({ tipo: "nao-encontrada" })
        if (status !== 200 || !dados) return setRelatorio({ tipo: "erro" })
        if (dados.status === "indisponivel") return setRelatorio({ tipo: "indisponivel", motivo: dados.motivo ?? "" })
        if (dados.status !== "ok" || !dados.relatorio) return setRelatorio({ tipo: "erro" })
        setRelatorio({ tipo: "ok", relatorio: dados.relatorio })
      } catch {
        if (!cancelado) setRelatorio({ tipo: "erro" })
        return
      }

      if (!comLeitura) return
      try {
        const { status, json } = await postar("/api/dimensoes/leitura", pedido)
        if (cancelado) return
        const dados = json as { status?: string; reading?: string; source?: "gemini" | "fallback" } | null
        if (status === 200 && dados?.status === "ok" && typeof dados.reading === "string" && (dados.source === "gemini" || dados.source === "fallback")) {
          setLeitura({ tipo: "ok", texto: dados.reading, origem: dados.source })
        } else {
          setLeitura({ tipo: "erro" })
        }
      } catch {
        if (!cancelado) setLeitura({ tipo: "erro" })
      }
    }

    void carregar(corpo)
    return () => {
      cancelado = true
    }
  }, [corpo, comLeitura])

  return { relatorio: corpo === null ? ({ tipo: "indisponivel", motivo: "" } as EstadoRelatorio) : relatorio, leitura }
}
