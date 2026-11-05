import type { ClassPercent, Projection } from "@/lib/simulador/projecao"
import type { SimRates } from "@/lib/simulador/taxas"
import type { PerfilEstado } from "@/lib/simulador/perfil"
import type { Profile } from "@/lib/suitability/scoring"

/** O que as telas precisam para mostrar uma simulação (calculada na hora ou salva). */
export interface SimulationView {
  origem: "analise" | "exemplo"
  profile: Profile
  allocation: ClassPercent[]
  rates: SimRates
  projection: Projection
  shortTerm: boolean
  /** Só na simulação feita na hora. */
  estado?: PerfilEstado
  analysisDate?: string | null
  alocacaoBase?: boolean
}

export interface ReadingView {
  reading: string
  source: "gemini" | "fallback"
}
