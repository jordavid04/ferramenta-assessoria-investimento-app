/**
 * Cenário econômico em números prontos + faixas qualitativas.
 * É o que a IA recebe: ela apenas explica estes valores, não busca nem calcula nenhum.
 */
import type { Profile } from "../suitability/scoring.ts";
import type { Trend } from "./indicators.ts";
import type { IndicatorView, RealRateView } from "./view.ts";

export interface ScenarioFacts {
  /** Todos arredondados em 2 casas, exatamente como aparecem nos cartões. */
  selic: number | null;
  cdi: number | null;
  ipca12m: number | null;
  realRate: number | null;
  selicTrend: Trend | null;
  ipcaTrend: Trend | null;
  dolarTrend: Trend | null;
}

export type JuroBand = "alto" | "medio" | "baixo";
export type InflacaoBand = "alta" | "moderada" | "baixa";
export type JuroRealBand = "alto" | "moderado" | "baixo";

export interface ScenarioBands {
  juro: JuroBand | null;
  inflacao: InflacaoBand | null;
  juroReal: JuroRealBand | null;
}

const r2 = (n: number | null): number | null => (n === null ? null : Math.round(n * 100) / 100);

export function factsFromViews(views: IndicatorView[], real: RealRateView | null): ScenarioFacts {
  const get = (id: IndicatorView["id"]) => views.find((v) => v.id === id);
  return {
    selic: r2(get("selic")?.value ?? null),
    cdi: r2(get("cdi")?.value ?? null),
    ipca12m: r2(get("ipca")?.value ?? null),
    realRate: r2(real?.value ?? null),
    selicTrend: get("selic")?.trend ?? null,
    ipcaTrend: get("ipca")?.trend ?? null,
    dolarTrend: get("dolar")?.trend ?? null,
  };
}

/** Faixas simples: Selic ≥ 12 alta, ≤ 8 baixa; IPCA acima do teto da meta (4,5%) alta, abaixo de 3% baixa. */
export function bandsOf(f: ScenarioFacts): ScenarioBands {
  return {
    juro: f.selic === null ? null : f.selic >= 12 ? "alto" : f.selic <= 8 ? "baixo" : "medio",
    inflacao: f.ipca12m === null ? null : f.ipca12m > 4.5 ? "alta" : f.ipca12m < 3 ? "baixa" : "moderada",
    juroReal: f.realRate === null ? null : f.realRate > 6 ? "alto" : f.realRate < 3 ? "baixo" : "moderado",
  };
}

/** Há dados mínimos (Selic e IPCA) para uma leitura do cenário? */
export function hasMinimumFacts(f: ScenarioFacts): boolean {
  return f.selic !== null && f.ipca12m !== null;
}

/**
 * Chave de cache da leitura: perfil (ou "geral") + os mesmos números exibidos.
 * Muda quando Selic/CDI/IPCA/juro real ou as tendências mudam — não a cada dia.
 */
export function scenarioKey(profile: Profile | null, f: ScenarioFacts): string {
  return [
    profile ?? "geral",
    f.selic,
    f.cdi,
    f.ipca12m,
    f.realRate,
    f.selicTrend,
    f.ipcaTrend,
    f.dolarTrend,
  ].join("|");
}
