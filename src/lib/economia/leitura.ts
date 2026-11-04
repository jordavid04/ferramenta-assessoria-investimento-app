/**
 * Monta a "leitura do cenário" para a página: descobre qual perfil usar (anônimo, sem análise,
 * com perfil, perfil antigo) e pede a leitura personalizada ou geral.
 * Usa só o perfil da análise mais recente da conta — nenhum dado pessoal novo.
 */
import { getLatestSessionSummary, type SessionSummary } from "../db.ts";
import type { Profile } from "../suitability/scoring.ts";
import type { EconomicInsight } from "./content-guard.ts";
import { getEconomicInsight, type InsightOutcome } from "./insight.ts";
import { factsFromViews, hasMinimumFacts, type ScenarioFacts } from "./scenario.ts";
import { getEconomicSnapshot, type EconomicSnapshot } from "./snapshot.ts";

/** Depois deste prazo a página sugere refazer o questionário. */
export const PROFILE_MAX_AGE_DAYS = 365;

export type ProfileState = "anonimo" | "sem-analise" | "com-perfil" | "perfil-antigo" | "perfil-indisponivel";

export interface LeituraResponse {
  state: ProfileState;
  profile: Profile | null;
  /** Data (ISO) da análise usada, quando há perfil. */
  analysisDate: string | null;
  source: "gemini" | "fallback" | null;
  /** null quando não há dados do cenário para explicar. */
  insight: EconomicInsight | null;
}

export interface LeituraDeps {
  getLatest?: (userId: string) => Promise<SessionSummary | null>;
  snapshot?: () => Promise<EconomicSnapshot>;
  insight?: (profile: Profile | null, facts: ScenarioFacts) => Promise<InsightOutcome>;
  now?: () => Date;
}

export async function resolveProfile(
  userId: string | null,
  deps: Pick<LeituraDeps, "getLatest" | "now"> = {},
): Promise<Pick<LeituraResponse, "state" | "profile" | "analysisDate">> {
  if (!userId) return { state: "anonimo", profile: null, analysisDate: null };
  const getLatest = deps.getLatest ?? getLatestSessionSummary;
  const now = (deps.now ?? (() => new Date()))();
  try {
    const latest = await getLatest(userId);
    if (!latest) return { state: "sem-analise", profile: null, analysisDate: null };
    const ageDays = (now.getTime() - Date.parse(latest.createdAt)) / 86_400_000;
    return {
      state: ageDays > PROFILE_MAX_AGE_DAYS ? "perfil-antigo" : "com-perfil",
      profile: latest.profile,
      analysisDate: latest.createdAt,
    };
  } catch (err) {
    // Falha ao ler o histórico não pode quebrar o painel: segue com a leitura geral.
    console.warn("[Economia] não foi possível ler o perfil da conta; usando leitura geral", err instanceof Error ? err.message : err);
    return { state: "perfil-indisponivel", profile: null, analysisDate: null };
  }
}

export async function buildLeitura(userId: string | null, deps: LeituraDeps = {}): Promise<LeituraResponse> {
  const who = await resolveProfile(userId, deps);
  const snapshot = await (deps.snapshot ?? getEconomicSnapshot)();
  const facts = factsFromViews(snapshot.indicators, snapshot.realRate);
  if (snapshot.status === "indisponivel" || !hasMinimumFacts(facts)) return { ...who, source: null, insight: null };
  const out = await (deps.insight ?? getEconomicInsight)(who.profile, facts);
  return { ...who, source: out.source, insight: out.insight };
}
