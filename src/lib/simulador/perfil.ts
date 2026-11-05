/**
 * De onde vêm o perfil e a alocação da simulação. Este módulo NUNCA recalcula nem altera o perfil:
 * - logado com análise → perfil e alocação gravados na análise mais recente (a que o usuário viu no resultado);
 * - logado sem análise ou anônimo → perfil de exemplo escolhido pela pessoa, com a alocação-base dele.
 */
import { BASE_ALLOCATION } from "../ai/allocation.ts";
import { getLatestAnalysisForUser, type LatestAnalysis } from "../db.ts";
import { PROFILE_MAX_AGE_DAYS } from "../economia/leitura.ts";
import { ASSET_CLASSES } from "../economia/content-guard.ts";
import type { Profile } from "../suitability/scoring.ts";
import { PROFILES } from "./premissas.ts";
import type { ClassPercent } from "./projecao.ts";

export { PROFILES };

export function isProfile(v: unknown): v is Profile {
  return typeof v === "string" && (PROFILES as string[]).includes(v);
}

export type PerfilEstado = "anonimo" | "sem-analise" | "com-analise" | "perfil-antigo" | "indisponivel";

export interface PerfilResolvido {
  estado: PerfilEstado;
  /** analise: perfil da conta · exemplo: perfil ilustrativo escolhido na tela. */
  origem: "analise" | "exemplo";
  profile: Profile;
  allocation: ClassPercent[];
  /** Data (ISO) da análise usada, quando origem = analise. */
  analysisDate: string | null;
  /** A alocação gravada na análise era inválida e foi trocada pela alocação-base do perfil. */
  alocacaoBase: boolean;
}

/** Resposta quando ainda falta escolher um perfil de exemplo. */
export interface PerfilPendente {
  estado: Exclude<PerfilEstado, "com-analise" | "perfil-antigo">;
  pendente: true;
}

export function baseAllocation(profile: Profile): ClassPercent[] {
  return BASE_ALLOCATION[profile].map((a) => ({ assetClass: a.assetClass, percent: a.percent }));
}

/** Valida a alocação gravada (cinco classes conhecidas, sem repetição, somando 100). null = inválida. */
export function normalizeAllocation(raw: unknown): ClassPercent[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const seen = new Set<string>();
  const out: ClassPercent[] = [];
  for (const item of raw) {
    const a = item as { assetClass?: unknown; percent?: unknown } | null;
    if (!a || typeof a.assetClass !== "string" || !(ASSET_CLASSES as string[]).includes(a.assetClass)) return null;
    if (typeof a.percent !== "number" || !Number.isFinite(a.percent) || a.percent < 0 || a.percent > 100) return null;
    if (seen.has(a.assetClass)) return null;
    seen.add(a.assetClass);
    out.push({ assetClass: a.assetClass as ClassPercent["assetClass"], percent: a.percent });
  }
  const sum = out.reduce((s, a) => s + a.percent, 0);
  return Math.abs(sum - 100) <= 0.01 ? out : null;
}

export interface PerfilDeps {
  getLatest?: (userId: string) => Promise<LatestAnalysis | null>;
  now?: () => Date;
}

/**
 * `requested` é o perfil de exemplo escolhido na tela (ignorado quando a conta tem análise).
 * Nunca lança: falha ao ler o histórico vira "indisponivel" e a simulação segue com perfil de exemplo.
 */
export async function resolvePerfil(
  userId: string | null,
  requested: unknown,
  deps: PerfilDeps = {},
): Promise<PerfilResolvido | PerfilPendente> {
  let estado: PerfilEstado = "anonimo";
  let latest: LatestAnalysis | null = null;

  if (userId) {
    try {
      latest = await (deps.getLatest ?? getLatestAnalysisForUser)(userId);
      estado = latest ? "com-analise" : "sem-analise";
    } catch (err) {
      console.warn("[Simulador] não foi possível ler a análise da conta; usando perfil de exemplo", err instanceof Error ? err.message : err);
      estado = "indisponivel";
    }
  }

  if (latest) {
    const now = (deps.now ?? (() => new Date()))();
    const ageDays = (now.getTime() - Date.parse(latest.createdAt)) / 86_400_000;
    const stored = normalizeAllocation(latest.allocation);
    if (!stored) console.warn("[Simulador] alocação gravada na análise inválida; usando a alocação-base do perfil");
    return {
      estado: ageDays > PROFILE_MAX_AGE_DAYS ? "perfil-antigo" : "com-analise",
      origem: "analise",
      profile: latest.profile,
      allocation: stored ?? baseAllocation(latest.profile),
      analysisDate: latest.createdAt,
      alocacaoBase: !stored,
    };
  }

  if (!isProfile(requested)) return { estado: estado as PerfilPendente["estado"], pendente: true };
  return {
    estado,
    origem: "exemplo",
    profile: requested,
    allocation: baseAllocation(requested),
    analysisDate: null,
    alocacaoBase: false,
  };
}

export function isPendente(p: PerfilResolvido | PerfilPendente): p is PerfilPendente {
  return "pendente" in p;
}
