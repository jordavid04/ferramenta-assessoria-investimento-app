/**
 * "Leitura" da simulação: texto curto que explica o resultado para o perfil.
 * A IA recebe os números prontos (calculados em projecao.ts) e apenas os explica. Se ela falhar, ou o texto
 * for reprovado pela verificação (guarda.ts), entra o texto local (modo offline).
 */
import { createHash } from "node:crypto";
import { generateJson } from "../ai/gemini.ts";
import * as db from "../db.ts";
import { fmtBRL, fmtPercent } from "../economia/format.ts";
import type { Profile } from "../suitability/scoring.ts";
import { fmtMonths, fmtYears } from "./format.ts";
import { checkSimText, MAX_SIM_TEXT_LENGTH, type GuardInput } from "./guarda.ts";
import { ASSUMPTIONS_VERSION, CLASSES, SCENARIO_LABEL, SCENARIOS } from "./premissas.ts";
import { riskySharePercent } from "./projecao.ts";

/** Uma leitura da IA para o mesmo resultado é reaproveitada por este tempo. */
export const READING_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Depois de uma falha da IA, espera antes de tentar de novo (evita travar a página a cada visita). */
export const AI_FAILURE_BACKOFF_MS = 5 * 60 * 1000;

export interface ReadingOutcome {
  text: string;
  source: "gemini" | "fallback";
  fallbackReason?: string;
}

export { fmtMonths, fmtYears };

/* ------------------------------ Prompt ------------------------------ */

function goalLine(g: GuardInput, s: (typeof SCENARIOS)[number]): string {
  const goal = g.projection.scenarios[s].goal;
  if (!goal) return "";
  const when = goal.reached ? (goal.month === 0 ? "já no início" : `em ${fmtMonths(goal.month!)}`) : `não atingida; faltariam ${fmtBRL(goal.shortfall)} ao final do prazo`;
  return ` · meta de ${fmtBRL(goal.target)}: ${when}`;
}

export function buildReadingPrompt(g: GuardInput): string {
  const p = g.projection;
  const alloc = g.allocation.filter((a) => a.percent > 0).map((a) => `${a.assetClass} ${a.percent}%`).join(", ");
  const scenarioLines = SCENARIOS.map((s) => {
    const r = p.scenarios[s];
    const rates = CLASSES.filter((c) => g.allocation.some((a) => a.assetClass === c && a.percent > 0))
      .map((c) => `${c} ${fmtPercent(r.classRates[c])}`)
      .join("; ");
    return `- ${SCENARIO_LABEL[s]}: valor final hipotético ${fmtBRL(r.finalValue)}; rendimento hipotético ${fmtBRL(r.earnings)}; em poder de compra de hoje ${fmtBRL(r.realValue)}; diferença para só acompanhar a inflação ${fmtBRL(r.vsInflation)}${goalLine(g, s)}\n  taxas anuais usadas: ${rates}`;
  }).join("\n");
  const range = p.scenarios.otimista.finalValue - p.scenarios.pessimista.finalValue;

  return `Você é um assistente de educação financeira para investidores iniciantes brasileiros (público prioritário: servidores públicos).
Explique, em linguagem simples, o resultado de uma SIMULAÇÃO HIPOTÉTICA de patrimônio para o perfil abaixo.

PERFIL DO INVESTIDOR (já calculado pelo sistema; NÃO recalcule nem contradiga): ${g.profile}
ALOCAÇÃO DO PERFIL (NÃO altere): ${alloc}
Parte da alocação em classes de maior oscilação (fundos imobiliários, ETFs e ações): ${riskySharePercent(g.allocation)}%

ENTRADAS: valor inicial ${fmtBRL(p.input.initial)}; aporte mensal ${fmtBRL(p.input.monthly)}; prazo ${fmtYears(p.input.years)}; total investido do próprio bolso ${fmtBRL(p.invested)}
Para apenas acompanhar a inflação, o dinheiro precisaria chegar a ${fmtBRL(p.inflationValue)}.
Premissas: CDI ${fmtPercent(p.rates.cdi)} ao ano e inflação ${fmtPercent(p.rates.ipca12m)} ao ano. Renda fixa e fundos acompanham o CDI; fundos imobiliários, ETFs e ações acompanham a inflação mais um prêmio, com variação maior entre os cenários.

RESULTADOS (calculados pelo sistema; use SOMENTE estes números):
${scenarioLines}
Diferença entre o cenário otimista e o pessimista: ${fmtBRL(range)}

REGRAS:
- Você apenas explica os números acima. Não calcule, não arredonde de outro jeito e não invente valores, percentuais ou prazos; todo valor em R$, percentual ou prazo no texto deve ser um dos fornecidos. Escreva os valores completos (por exemplo "R$ 1.234,56"), sem abreviar como "mil" ou "milhão".
- Explique: (1) por que a faixa entre o cenário pessimista e o otimista é larga ou estreita para este perfil; (2) o peso da constância dos aportes e do prazo; (3) o que muda, de forma geral, se o prazo aumentar, sem citar outros prazos nem novos números.
- Se o cenário pessimista terminar abaixo do total investido, diga isso com clareza: perdas são possíveis.
- Use linguagem condicional ("no cenário base, o valor hipotético seria..."). NUNCA prometa rentabilidade nem escreva "você vai ter", "garantido" ou "certeza".
- Não use linguagem de recomendação ("compre", "venda", "invista", "recomendo", "você deve"). NUNCA cite tickers nem ativos específicos; fale só de tipos de produto.
- Mencione apenas o perfil ${g.profile}. Responda em português do Brasil, sem markdown, sem links.

FORMATO: devolva SOMENTE um JSON válido: {"reading": "4 a 7 frases (máx. ${MAX_SIM_TEXT_LENGTH - 300} caracteres)"}`;
}

/** Valida o JSON da IA (lança erro se estiver fora do contrato). */
export function parseReading(raw: unknown): string {
  const r = raw as { reading?: unknown } | null;
  if (!r || typeof r.reading !== "string" || r.reading.trim().length === 0) throw new Error("JSON da IA fora do contrato esperado");
  return r.reading.trim();
}

/* ---------------------------- Texto local ---------------------------- */

function rangeSentence(profile: Profile, risky: number, amplitude: number): string {
  const a = fmtBRL(amplitude);
  const share = risky === 0 ? "nenhuma parte da alocação está" : `apenas ${risky}% da alocação está`;
  if (risky <= 20) {
    return `Para o perfil ${profile}, a faixa entre o cenário pessimista e o otimista é relativamente estreita (diferença de ${a}), porque ${share} em classes de maior oscilação (fundos imobiliários, ETFs e ações) e o restante acompanha o CDI.`;
  }
  if (risky >= 50) {
    return `Para o perfil ${profile}, a faixa entre o cenário pessimista e o otimista é larga (diferença de ${a}), porque ${risky}% da alocação está em classes de maior oscilação (fundos imobiliários, ETFs e ações), que podem ir muito bem ou muito mal conforme o cenário.`;
  }
  return `Para o perfil ${profile}, a faixa entre o cenário pessimista e o otimista é intermediária (diferença de ${a}), porque ${risky}% da alocação está em classes de maior oscilação (fundos imobiliários, ETFs e ações) e o restante acompanha o CDI.`;
}

/** Texto local (sem IA): determinístico, por perfil. Passa na mesma verificação do texto da IA. */
export function localReading(g: GuardInput): string {
  const p = g.projection;
  const [pess, base, ot] = [p.scenarios.pessimista, p.scenarios.base, p.scenarios.otimista];
  const risky = riskySharePercent(g.allocation);
  const parts: string[] = [];

  parts.push(
    `Com um prazo de ${fmtYears(p.input.years)} e um total investido de ${fmtBRL(p.invested)} do seu próprio bolso, o valor hipotético seria de ${fmtBRL(pess.finalValue)} no cenário pessimista, ${fmtBRL(base.finalValue)} no cenário base e ${fmtBRL(ot.finalValue)} no cenário otimista.`,
  );
  parts.push(rangeSentence(g.profile, risky, ot.finalValue - pess.finalValue));

  if (pess.belowInvested) {
    parts.push("No cenário pessimista, o valor hipotético ficaria abaixo do total investido: perdas são possíveis, principalmente nas classes de maior oscilação.");
  } else if (pess.vsInflation < 0) {
    parts.push(`No cenário pessimista, o valor hipotético ficaria ${fmtBRL(Math.abs(pess.vsInflation))} abaixo do que seria preciso para apenas acompanhar a inflação.`);
  }

  parts.push(`Descontada a inflação, o cenário base equivale a ${fmtBRL(base.realValue)} em poder de compra de hoje.`);

  const riskyBelowFixed = risky > 0 && base.classRates["Ações"] < base.classRates["Renda Fixa"];
  if (riskyBelowFixed) {
    parts.push("Com o CDI no nível atual, as hipóteses do cenário base para as classes de maior oscilação ficam abaixo das da renda fixa: assumir mais risco não significa, por si só, retorno maior.");
  }

  parts.push(
    "A constância dos aportes e o prazo pesam bastante: quanto mais tempo o dinheiro fica aplicado, mais os rendimentos se acumulam sobre os rendimentos anteriores. Um prazo maior tende a ampliar o efeito dos aportes e também a distância entre os cenários.",
  );

  const goal = base.goal;
  if (goal) {
    if (goal.reached) {
      parts.push(`Em relação à meta de ${fmtBRL(goal.target)}, o cenário base a alcançaria ${goal.month === 0 ? "já no início" : `em ${fmtMonths(goal.month!)}`}.`);
    } else {
      parts.push(`Em relação à meta de ${fmtBRL(goal.target)}, o cenário base ficaria ${fmtBRL(goal.shortfall)} abaixo ao final do prazo.`);
    }
  }

  parts.push("São hipóteses didáticas, com valores brutos e sem impostos, e não uma previsão.");
  return parts.join(" ");
}

/* --------------------------- Cache e serviço --------------------------- */

export interface ReadingCache {
  load(key: string): Promise<{ text: string; createdAt: string } | null>;
  save(key: string, text: string): Promise<void>;
}

const DB_TIMEOUT_MS = 3_000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Banco demorou demais para responder")), DB_TIMEOUT_MS);
    promise.then(
      (v) => (clearTimeout(timer), resolve(v)),
      (e) => (clearTimeout(timer), reject(e)),
    );
  });
}

/** Memória do processo + tabela economic_insights (chave 'sim|...'). Falha de cache nunca propaga. */
export function createReadingCache(now: () => Date = () => new Date(), dbOps: Pick<typeof db, "getEconomicInsightRow" | "saveEconomicInsightRow"> = db): ReadingCache {
  const memory = new Map<string, { text: string; createdAt: string }>();
  const warn = (err: unknown) => {
    if (err instanceof Error && err.name === "DatabaseDisabledError") return;
    console.warn("[Simulador] cache em banco indisponível; usando memória", err instanceof Error ? err.message : err);
  };
  return {
    async load(key) {
      const mem = memory.get(key);
      if (mem) return mem;
      try {
        const row = await withTimeout(dbOps.getEconomicInsightRow(key));
        const text = (row?.payload as { reading?: unknown } | undefined)?.reading;
        return row && typeof text === "string" ? { text, createdAt: row.createdAt } : null;
      } catch (err) {
        warn(err);
        return null;
      }
    },
    async save(key, text) {
      memory.set(key, { text, createdAt: now().toISOString() });
      try {
        await withTimeout(dbOps.saveEconomicInsightRow(key, { kind: "simulador", reading: text }));
      } catch (err) {
        warn(err);
      }
    },
  };
}

/** Chave do cache: mesmo perfil, alocação, entradas e taxas => mesmo texto. Só guarda um hash. */
export function readingCacheKey(g: GuardInput): string {
  const p = g.projection;
  const digest = createHash("sha256")
    .update(JSON.stringify({ v: ASSUMPTIONS_VERSION, profile: g.profile, allocation: g.allocation, input: p.input, cdi: p.rates.cdi, ipca: p.rates.ipca12m }))
    .digest("hex")
    .slice(0, 32);
  return `sim|v${ASSUMPTIONS_VERSION}|${digest}`;
}

export interface ReadingDeps {
  generate?: (prompt: string) => Promise<unknown>;
  cache?: ReadingCache;
  now?: () => Date;
  hasKey?: () => boolean;
}

export function createReadingService(deps: ReadingDeps = {}) {
  const generate = deps.generate ?? generateJson;
  const now = deps.now ?? (() => new Date());
  const hasKey = deps.hasKey ?? (() => !!process.env.GEMINI_API_KEY);
  const pending = new Map<string, Promise<ReadingOutcome>>();
  let lastFailureAt = Number.NEGATIVE_INFINITY;
  let defaultCache: ReadingCache | null = null;
  const getCache = () => deps.cache ?? (defaultCache ??= createReadingCache(now));

  function fallback(g: GuardInput, reason: string): ReadingOutcome {
    console.warn("[IA] leitura da simulação: usando texto local", { reason });
    return { text: localReading(g), source: "fallback", fallbackReason: reason };
  }

  async function generateFresh(key: string, g: GuardInput): Promise<ReadingOutcome> {
    const at = now().getTime();
    try {
      const text = parseReading(await generate(buildReadingPrompt(g)));
      const reasons = checkSimText(text, g);
      if (reasons.length > 0) throw new Error(`Texto da IA reprovado na verificação: ${reasons.join("; ")}`);
      await getCache().save(key, text).catch((err) => console.warn("[Simulador] não foi possível guardar a leitura", err));
      return { text, source: "gemini" };
    } catch (err) {
      lastFailureAt = at;
      return fallback(g, err instanceof Error ? err.message : "erro desconhecido");
    }
  }

  return {
    /** Nunca lança: qualquer problema com a IA vira o texto local. */
    async get(g: GuardInput): Promise<ReadingOutcome> {
      const key = readingCacheKey(g);

      const cached = await getCache().load(key).catch(() => null);
      if (cached && now().getTime() - Date.parse(cached.createdAt) < READING_TTL_MS && checkSimText(cached.text, g).length === 0) {
        return { text: cached.text, source: "gemini" };
      }

      if (!hasKey()) return fallback(g, "GEMINI_API_KEY não configurada");
      if (now().getTime() - lastFailureAt < AI_FAILURE_BACKOFF_MS) return fallback(g, "IA indisponível há pouco; nova tentativa em instantes");

      let p = pending.get(key);
      if (!p) {
        p = generateFresh(key, g).finally(() => pending.delete(key));
        pending.set(key, p);
      }
      return p;
    },
  };
}

let defaultService: ReturnType<typeof createReadingService> | null = null;

export function getSimulationReading(g: GuardInput): Promise<ReadingOutcome> {
  defaultService ??= createReadingService();
  return defaultService.get(g);
}
