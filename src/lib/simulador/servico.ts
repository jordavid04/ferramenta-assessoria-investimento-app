/**
 * Orquestra uma simulação: valida as entradas, resolve perfil e alocação, obtém CDI/inflação e calcula.
 * É o único caminho usado pelas rotas, inclusive ao salvar (o servidor recalcula; nunca confia em resultado do cliente).
 */
import { type PerfilDeps, type PerfilResolvido, isPendente, resolvePerfil } from "./perfil.ts";
import type { GuardInput } from "./guarda.ts";
import { project, type Projection } from "./projecao.ts";
import { SHORT_TERM_YEARS } from "./premissas.ts";
import { getSimRates, type RatesDeps, type SimRates } from "./taxas.ts";
import { validateInput, type InputField } from "./validacao.ts";

export interface SimulationData {
  perfil: PerfilResolvido;
  rates: SimRates;
  projection: Projection;
  /** Prazo abaixo de 1 ano: a simulação é pouco representativa. */
  shortTerm: boolean;
}

export type PrepareResult =
  | { ok: true; data: SimulationData }
  | { ok: false; status: number; error: string; fields?: Partial<Record<InputField, string>>; needsProfile?: boolean };

export interface PrepareDeps extends PerfilDeps, RatesDeps {}

export async function prepareSimulation(body: unknown, userId: string | null, deps: PrepareDeps = {}): Promise<PrepareResult> {
  const input = validateInput(body);
  if (!input.ok) return { ok: false, status: 422, error: input.error, fields: input.fields };

  const requested = (body as { profile?: unknown } | null)?.profile;
  const perfil = await resolvePerfil(userId, requested, deps);
  if (isPendente(perfil)) {
    return { ok: false, status: 422, error: "Escolha um perfil de exemplo para simular.", needsProfile: true };
  }

  const rates = await getSimRates(deps);
  const projection = project(input.value, perfil.allocation, { cdi: rates.cdi, ipca12m: rates.ipca12m });
  return { ok: true, data: { perfil, rates, projection, shortTerm: input.value.years < SHORT_TERM_YEARS } };
}

/** Resposta HTTP de erro de validação/perfil: só `error`, `fields` e `needsProfile`, sem os campos internos. */
export function errorResponse(result: Extract<PrepareResult, { ok: false }>): Response {
  const { status, error, fields, needsProfile } = result;
  return Response.json({ error, ...(fields ? { fields } : {}), ...(needsProfile ? { needsProfile } : {}) }, { status });
}

export function guardInputOf(data: SimulationData): GuardInput {
  return { projection: data.projection, allocation: data.perfil.allocation, profile: data.perfil.profile };
}
