/**
 * "Leitura do cenário": texto educativo sobre o que o cenário significa para o perfil.
 * A IA recebe números prontos e só os explica; se ela falhar ou for reprovada pela verificação,
 * entra o texto local (modo offline), com regras simples por perfil e por cenário.
 */
import { generateJson } from "../ai/gemini.ts";
import { BASE_ALLOCATION, type AssetClass } from "../ai/allocation.ts";
import type { Profile } from "../suitability/scoring.ts";
import {
  allowedNumbersFor,
  ASSET_CLASSES,
  checkInsight,
  MAX_CLASS_NOTES,
  type EconomicInsight,
  type GuardContext,
} from "./content-guard.ts";
import { fmtNumber, fmtPercent } from "./format.ts";
import type { Trend } from "./indicators.ts";
import { bandsOf, scenarioKey, type ScenarioFacts } from "./scenario.ts";
import { getDefaultStore, type EconomicStore } from "./store.ts";

/** Uma leitura da IA para o mesmo perfil e cenário é reaproveitada por este tempo. */
export const INSIGHT_TTL_MS = 24 * 60 * 60 * 1000;
/** Depois de uma falha da IA, espera antes de tentar de novo (evita travar a página a cada visita). */
export const AI_FAILURE_BACKOFF_MS = 5 * 60 * 1000;

export interface InsightOutcome {
  insight: EconomicInsight;
  source: "gemini" | "fallback";
  fallbackReason?: string;
}

/* ------------------------------ Prompt ------------------------------ */

const TREND_TEXT: Record<Trend, string> = { alta: "em alta", queda: "em queda", estavel: "estável" };

function factLines(f: ScenarioFacts): string[] {
  const lines: string[] = [];
  if (f.selic !== null) lines.push(`- Taxa Selic: ${fmtNumber(f.selic)}% ao ano${f.selicTrend ? ` (${TREND_TEXT[f.selicTrend]} em relação a 30 dias antes)` : ""}`);
  if (f.cdi !== null) lines.push(`- Taxa CDI: ${fmtNumber(f.cdi)}% ao ano`);
  if (f.ipca12m !== null) lines.push(`- Inflação (IPCA) acumulada em 12 meses: ${fmtNumber(f.ipca12m)}%${f.ipcaTrend ? ` (${TREND_TEXT[f.ipcaTrend]} em relação ao mês anterior)` : ""}`);
  if (f.realRate !== null) lines.push(`- Juro real (Selic descontada a inflação, calculado pelo sistema): ${fmtNumber(f.realRate)}% ao ano`);
  if (f.dolarTrend) lines.push(`- Dólar: ${TREND_TEXT[f.dolarTrend]} em relação a 30 dias antes (não cite a cotação)`);
  return lines;
}

export function buildEconomicPrompt(profile: Profile | null, facts: ScenarioFacts): string {
  const classes = profile ? BASE_ALLOCATION[profile].filter((a) => a.percent > 0).map((a) => a.assetClass) : ASSET_CLASSES;
  const profileBlock = profile
    ? `PERFIL DO INVESTIDOR (já calculado pelo sistema; NÃO recalcule nem contradiga): ${profile}
ALOCAÇÃO-BASE DO PERFIL (NÃO altere): ${JSON.stringify(BASE_ALLOCATION[profile].map((a) => ({ assetClass: a.assetClass, percent: a.percent })))}
Cite o perfil ${profile} pelo nome na leitura e relacione o cenário às classes da alocação-base.`
    : `O investidor ainda não tem perfil: faça uma explicação GERAL do cenário, sem atribuir um perfil ao leitor.`;

  return `Você é um assistente de educação financeira para investidores iniciantes brasileiros (público prioritário: servidores públicos).
Explique, em linguagem simples, o que o cenário econômico atual significa para quem investe.

NÚMEROS DO CENÁRIO (fornecidos e calculados pelo sistema; use SOMENTE estes valores):
${factLines(facts).join("\n")}

${profileBlock}

REGRAS:
- Você apenas explica os números acima. Não busque nem invente números, datas ou cotações; qualquer percentual ou valor em R$ no texto deve ser um dos fornecidos.
- Fale das classes: ${classes.join(", ")}. Use apenas tipos de produto genéricos; NUNCA cite tickers ou ativos específicos.
- Seja educativo: nunca prometa rentabilidade ou ganho, e não use linguagem de recomendação individual ("compre", "venda", "invista", "recomendo", "você deve").
- Responda em português do Brasil, sem markdown, sem links.

FORMATO: devolva SOMENTE um JSON válido:
{"reading": "3 a 5 frases (máx. 700 caracteres) explicando o cenário${profile ? ` para o perfil ${profile}` : ""}",
 "classNotes": [{"assetClass": "uma entre ${classes.join(" | ")}", "note": "1 frase (máx. 220 caracteres) sobre como o cenário se relaciona com a classe"}]}
Inclua uma nota para cada classe listada acima.`;
}

/** Valida o JSON da IA (lança erro se estiver fora do contrato). */
export function parseInsight(raw: unknown): EconomicInsight {
  const r = raw as { reading?: unknown; classNotes?: unknown } | null;
  const ok =
    !!r &&
    typeof r.reading === "string" &&
    r.reading.trim().length > 0 &&
    Array.isArray(r.classNotes) &&
    r.classNotes.length >= 1 &&
    r.classNotes.length <= MAX_CLASS_NOTES &&
    r.classNotes.every(
      (n) =>
        typeof n?.assetClass === "string" &&
        (ASSET_CLASSES as string[]).includes(n.assetClass) &&
        typeof n?.note === "string" &&
        n.note.trim().length > 0,
    );
  if (!ok) throw new Error("JSON da IA fora do contrato esperado");
  const notes = r.classNotes as { assetClass: AssetClass; note: string }[];
  return {
    reading: (r.reading as string).trim(),
    classNotes: notes.map((n) => ({ assetClass: n.assetClass, note: n.note.trim() })),
  };
}

/* ---------------------------- Texto local ---------------------------- */

function juroSentence(f: ScenarioFacts): string {
  if (f.selic === null) return "";
  const band = bandsOf(f).juro;
  const s = fmtPercent(f.selic);
  const base =
    band === "alto"
      ? `Com a Selic em ${s} ao ano, o juro está em patamar alto: o crédito fica mais caro e a renda fixa paga mais.`
      : band === "baixo"
        ? `Com a Selic em ${s} ao ano, o juro está em patamar baixo: a renda fixa paga menos e outras classes ganham atenção, com mais risco.`
        : `Com a Selic em ${s} ao ano, o juro está em patamar intermediário, sem favorecer de forma clara a renda fixa nem a renda variável.`;
  const move = f.selicTrend === "alta" ? " A taxa subiu nas últimas semanas." : f.selicTrend === "queda" ? " A taxa caiu nas últimas semanas." : "";
  return base + move;
}

function inflacaoSentence(f: ScenarioFacts): string {
  if (f.ipca12m === null) return "";
  const band = bandsOf(f).inflacao;
  const p = fmtPercent(f.ipca12m);
  if (band === "alta") return `A inflação acumulada em 12 meses está em ${p}, acima do teto da meta, o que corrói o poder de compra.`;
  if (band === "baixa") return `A inflação acumulada em 12 meses está em ${p}, em nível baixo, o que ajuda a preservar o poder de compra.`;
  return `A inflação acumulada em 12 meses está em ${p}, em nível moderado.`;
}

function juroRealSentence(f: ScenarioFacts): string {
  if (f.realRate === null) return "";
  const p = fmtPercent(f.realRate);
  if (f.realRate < 0) return `Descontada a inflação, o juro real está negativo em ${p} ao ano: a inflação supera o que a Selic paga.`;
  const band = bandsOf(f).juroReal;
  const tail =
    band === "alto"
      ? "um patamar elevado, que favorece quem busca segurança na renda fixa."
      : band === "baixo"
        ? "um patamar pequeno, que deixa a renda fixa pouco acima da inflação."
        : "um patamar intermediário acima da inflação.";
  return `Descontada a inflação, o juro real está em ${p} ao ano, ${tail}`;
}

function dolarSentence(f: ScenarioFacts): string {
  if (f.dolarTrend === "alta") return "O dólar subiu em relação a 30 dias antes, o que pode afetar ativos ligados ao exterior e os preços de produtos importados.";
  if (f.dolarTrend === "queda") return "O dólar caiu em relação a 30 dias antes, o que pode aliviar os preços de produtos importados e afetar ativos ligados ao exterior.";
  if (f.dolarTrend === "estavel") return "O dólar ficou estável em relação a 30 dias antes.";
  return "";
}

function pct(profile: Profile, c: AssetClass): number {
  return BASE_ALLOCATION[profile].find((a) => a.assetClass === c)?.percent ?? 0;
}

function profileSentence(profile: Profile, f: ScenarioFacts): string {
  const juro = bandsOf(f).juro ?? "medio";
  const rf = pct(profile, "Renda Fixa");
  const ac = pct(profile, "Ações");
  switch (profile) {
    case "Conservador":
      return juro === "alto"
        ? `Para o perfil Conservador, que prioriza a segurança, juros altos são um cenário favorável: a renda fixa, que concentra ${rf}% da alocação-base, remunera melhor sem exigir mais risco.`
        : juro === "baixo"
          ? `Para o perfil Conservador, juro baixo reduz o que a renda fixa (${rf}% da alocação-base) paga; buscar mais remuneração costuma exigir mais risco, e a prioridade do perfil segue sendo a segurança.`
          : `Para o perfil Conservador, o juro intermediário mantém a renda fixa, que concentra ${rf}% da alocação-base, como base da carteira, com remuneração mais moderada.`;
    case "Moderado":
      return juro === "alto"
        ? `Para o perfil Moderado, juros altos fortalecem a parte em renda fixa (${rf}% da alocação-base) e pedem atenção às classes de renda variável, que costumam sentir o custo maior do crédito.`
        : juro === "baixo"
          ? `Para o perfil Moderado, juro baixo diminui o atrativo da renda fixa (${rf}% da alocação-base), e a diversificação com fundos imobiliários, ETFs e ações ganha relevância, sempre com risco maior.`
          : `Para o perfil Moderado, o juro intermediário favorece o equilíbrio entre a renda fixa (${rf}% da alocação-base) e as demais classes, mantendo a diversificação.`;
    case "Arrojado":
      return juro === "alto"
        ? `Para o perfil Arrojado, juros altos aumentam a concorrência da renda fixa (${rf}% da alocação-base) com a renda variável; a parte em ações (${ac}%) e em fundos imobiliários tende a oscilar mais nesse cenário.`
        : juro === "baixo"
          ? `Para o perfil Arrojado, juro baixo costuma ser menos pesado para a renda variável, que tem ${ac}% em ações na alocação-base; ainda assim, o risco e a oscilação continuam presentes.`
          : `Para o perfil Arrojado, o juro intermediário sustenta a combinação entre renda fixa (${rf}%) e ações (${ac}%) da alocação-base, com as oscilações normais de mercado.`;
    case "Agressivo":
      return juro === "alto"
        ? `Para o perfil Agressivo, juros altos pressionam a renda variável, onde o perfil concentra ${ac}% em ações na alocação-base; é um cenário que exige tolerância a oscilações e visão de longo prazo.`
        : juro === "baixo"
          ? `Para o perfil Agressivo, juro baixo tende a ser menos pesado para a renda variável (${ac}% em ações na alocação-base), mas a volatilidade e o risco de perdas continuam.`
          : `Para o perfil Agressivo, o juro intermediário não elimina a volatilidade da renda variável (${ac}% em ações na alocação-base); a diversificação segue importante.`;
  }
}

function noteFor(c: AssetClass, f: ScenarioFacts): string {
  const b = bandsOf(f);
  const juro = b.juro ?? "medio";
  switch (c) {
    case "Renda Fixa":
      if (juro === "alto") {
        return b.inflacao === "alta"
          ? "Juros altos tornam a renda fixa mais atrativa, e títulos atrelados à inflação ajudam a proteger o poder de compra."
          : "Juros altos tornam a renda fixa mais atrativa; vale comparar prazos, liquidez e riscos de cada título.";
      }
      return juro === "baixo"
        ? "Com juros baixos, a renda fixa remunera menos; ela segue útil para a reserva de emergência e para dar estabilidade."
        : "A renda fixa segue como base de estabilidade; o que ela paga acompanha a Selic.";
    case "Fundos Imobiliários":
      return juro === "alto"
        ? "Juros altos costumam pesar sobre os preços dos fundos imobiliários, porque a renda fixa vira uma alternativa concorrente."
        : juro === "baixo"
          ? "Juros mais baixos costumam ser menos desfavoráveis aos fundos imobiliários, mas renda e preços podem variar."
          : "Os fundos imobiliários reagem ao juro, mas também à qualidade dos imóveis e dos contratos; a diversificação importa.";
    case "Ações":
      return juro === "alto"
        ? "Juros altos encarecem o crédito das empresas e aumentam a concorrência da renda fixa, o que costuma elevar a oscilação das ações."
        : juro === "baixo"
          ? "Juros baixos tendem a ser menos pesados para as empresas, mas as ações seguem com risco de perdas."
          : "As ações dependem do juro, mas também dos resultados das empresas; o prazo longo ajuda a diluir as oscilações.";
    case "ETFs":
      return f.dolarTrend === "alta"
        ? "Os ETFs acompanham um índice e diluem o risco de uma única empresa; com o dólar em alta, os ligados ao exterior sentem o efeito do câmbio."
        : "Os ETFs acompanham um índice e diluem o risco de uma única empresa, mas sentem o mesmo movimento de juros e de câmbio do mercado.";
    case "Fundos":
      return "Fundos de renda fixa e DI seguem de perto a Selic; fundos multimercado dependem das escolhas do gestor e têm taxas, então vale conferir os custos.";
  }
}

/** Texto local (sem IA): determinístico, por perfil e por cenário. Passa na mesma verificação do texto da IA. */
export function localInsight(profile: Profile | null, facts: ScenarioFacts): EconomicInsight {
  const parts = [juroSentence(facts), inflacaoSentence(facts), juroRealSentence(facts), dolarSentence(facts)];
  parts.push(profile ? profileSentence(profile, facts) : "Este é um panorama geral: o efeito do cenário muda conforme o perfil de cada investidor.");
  const classes = profile ? BASE_ALLOCATION[profile].filter((a) => a.percent > 0).map((a) => a.assetClass) : ASSET_CLASSES;
  return {
    reading: parts.filter(Boolean).join(" "),
    classNotes: classes.map((c) => ({ assetClass: c, note: noteFor(c, facts) })),
  };
}

/* ------------------------------ Serviço ------------------------------ */

export interface InsightDeps {
  generate?: (prompt: string) => Promise<unknown>;
  store?: EconomicStore;
  now?: () => Date;
  hasKey?: () => boolean;
}

export function createInsightService(deps: InsightDeps = {}) {
  const generate = deps.generate ?? generateJson;
  const now = deps.now ?? (() => new Date());
  const hasKey = deps.hasKey ?? (() => !!process.env.GEMINI_API_KEY);
  const pending = new Map<string, Promise<InsightOutcome>>();
  let lastFailureAt = Number.NEGATIVE_INFINITY;

  function fallback(profile: Profile | null, facts: ScenarioFacts, reason: string): InsightOutcome {
    console.warn("[IA] leitura do cenário: usando texto local", { reason });
    return { insight: localInsight(profile, facts), source: "fallback", fallbackReason: reason };
  }

  async function generateFresh(key: string, profile: Profile | null, facts: ScenarioFacts, store: EconomicStore): Promise<InsightOutcome> {
    const at = now().getTime();
    try {
      const insight = parseInsight(await generate(buildEconomicPrompt(profile, facts)));
      const ctx: GuardContext = { profile, allowedNumbers: allowedNumbersFor(facts, profile) };
      const check = checkInsight(insight, ctx);
      if (!check.ok) throw new Error(`Texto da IA reprovado na verificação: ${check.reasons.join("; ")}`);
      await store.saveInsight(key, insight).catch((err) => console.warn("[Economia] não foi possível guardar a leitura", err));
      return { insight, source: "gemini" };
    } catch (err) {
      lastFailureAt = at;
      return fallback(profile, facts, err instanceof Error ? err.message : "erro desconhecido");
    }
  }

  return {
    /** Nunca lança: qualquer problema com a IA vira o texto local. */
    async get(profile: Profile | null, facts: ScenarioFacts): Promise<InsightOutcome> {
      const store = deps.store ?? getDefaultStore();
      const key = scenarioKey(profile, facts);

      const cached = await store.loadInsight(key).catch(() => null);
      if (cached && now().getTime() - Date.parse(cached.createdAt) < INSIGHT_TTL_MS) {
        return { insight: cached.insight, source: "gemini" };
      }

      if (!hasKey()) return fallback(profile, facts, "GEMINI_API_KEY não configurada");
      if (now().getTime() - lastFailureAt < AI_FAILURE_BACKOFF_MS) return fallback(profile, facts, "IA indisponível há pouco; nova tentativa em instantes");

      let p = pending.get(key);
      if (!p) {
        p = generateFresh(key, profile, facts, store).finally(() => pending.delete(key));
        pending.set(key, p);
      }
      return p;
    },
  };
}

let defaultService: ReturnType<typeof createInsightService> | null = null;

export function getEconomicInsight(profile: Profile | null, facts: ScenarioFacts): Promise<InsightOutcome> {
  defaultService ??= createInsightService();
  return defaultService.get(profile, facts);
}
