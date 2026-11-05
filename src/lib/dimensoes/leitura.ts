/**
 * "Leitura" do perfil multidimensional: texto curto que explica o conjunto (dimensões, alertas e evolução).
 * A IA recebe os números prontos (calculados pelo sistema) e apenas os explica. Se ela falhar, ou o texto for
 * reprovado pela verificação (guarda.ts), entra o texto local (modo offline).
 */
import { createHash } from "node:crypto";
import { generateJson } from "../ai/gemini.ts";
import * as db from "../db.ts";
import { MAX_SCORE } from "../suitability/scoring.ts";
import { checarLeitura, MAX_LEITURA_LENGTH } from "./guarda.ts";
import { DIMENSION_INFO, DIMENSION_ORDER, FAIXA_ROTULO } from "./mapeamento.ts";
import type { EntradaLeitura } from "./tipos.ts";

/** Uma leitura da IA para os mesmos números é reaproveitada por este tempo. */
export const LEITURA_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Depois de uma falha da IA, espera antes de tentar de novo (evita travar a página a cada visita). */
export const AI_FAILURE_BACKOFF_MS = 5 * 60 * 1000;
/** Mude ao alterar o prompt, as regras ou o mapeamento: invalida as leituras guardadas. */
export const LEITURA_VERSAO = 1;

export interface LeituraOutcome {
  text: string;
  source: "gemini" | "fallback";
  fallbackReason?: string;
}

/* ------------------------------ Prompt ------------------------------ */

function linhasDeEvolucao(e: EntradaLeitura): string[] {
  const ev = e.evolucao;
  if (!ev) return ["Não há análise anterior para comparar."];
  const linhas = [
    `Análise anterior: ${ev.anterior.pontuacao} de ${MAX_SCORE} pontos, perfil ${ev.anterior.perfil}.`,
    ...ev.variacoes.map(
      (v) => `- ${v.nome}: de ${v.de}% para ${v.para}% (${v.sentido === "estavel" ? "estável" : `${v.sentido} ${Math.abs(v.delta)} pontos percentuais`})`,
    ),
  ];
  return linhas;
}

export function buildLeituraPrompt(e: EntradaLeitura): string {
  const dimensoes = e.dimensoes
    .map((d) => `- ${d.nome} (${DIMENSION_INFO[d.id].significado}): ${d.nota}% (${FAIXA_ROTULO[d.faixa]}). ${d.resumo}`)
    .join("\n");
  const alertas =
    e.alertas.length === 0
      ? "Nenhum alerta: o sistema não encontrou contradições entre as respostas."
      : e.alertas.map((a) => `- ${a.nome}: ${a.texto}`).join("\n");

  return `Você é um assistente de educação financeira para investidores iniciantes brasileiros (público prioritário: servidores públicos).
Explique, em linguagem simples e acolhedora, o PERFIL MULTIDIMENSIONAL abaixo. Os números e os alertas já foram calculados pelo sistema.

PERFIL (já calculado pelo sistema; NÃO recalcule nem contradiga): ${e.perfil}, ${e.pontuacao} de ${MAX_SCORE} pontos

DIMENSÕES (notas de 0 a 100%, calculadas pelo sistema; use SOMENTE estes números):
${dimensoes}

ALERTAS DE COERÊNCIA (calculados pelo sistema; são informativos e não mudam o perfil):
${alertas}

EVOLUÇÃO EM RELAÇÃO À ANÁLISE ANTERIOR:
${linhasDeEvolucao(e).join("\n")}

REGRAS:
- Você apenas explica o que está acima. Não calcule, não invente números e não contradiga as notas, as faixas nem os alertas. Todo número no texto deve ser um dos fornecidos.
- Explique em poucas palavras o que significa cada dimensão, comente os alertas (se houver) de forma construtiva e neutra, sem tom de acusação, e sugira pontos de reflexão (por exemplo: "vale pensar se o prazo e a tolerância a oscilações estão alinhados"). Se houver evolução, comente brevemente o que mudou.
- Se não houver alertas, diga que as respostas parecem coerentes. Se houver, NUNCA diga que não há inconsistências.
- NUNCA diga que o perfil deveria ser outro, nem sugira mudar de perfil. Mencione apenas o perfil ${e.perfil}.
- NUNCA prometa rentabilidade nem escreva "você vai ter", "garantido" ou "certeza". Não use linguagem de recomendação ("compre", "venda", "invista", "recomendo", "você deve"). NUNCA cite tickers nem ativos específicos.
- Responda em português do Brasil, sem markdown, sem links.

FORMATO: devolva SOMENTE um JSON válido: {"reading": "5 a 8 frases (máx. ${MAX_LEITURA_LENGTH - 400} caracteres)"}`;
}

/** Valida o JSON da IA (lança erro se estiver fora do contrato). */
export function parseLeitura(raw: unknown): string {
  const r = raw as { reading?: unknown } | null;
  if (!r || typeof r.reading !== "string" || r.reading.trim().length === 0) throw new Error("JSON da IA fora do contrato esperado");
  return r.reading.trim();
}

/* ---------------------------- Texto local ---------------------------- */

/** Texto local (sem IA): determinístico, montado das dimensões, alertas e evolução. Passa na mesma verificação do texto da IA. */
export function leituraLocal(e: EntradaLeitura): string {
  const partes: string[] = [];
  partes.push(
    `Seu perfil é ${e.perfil}, com ${e.pontuacao} de ${MAX_SCORE} pontos. Ele vem do conjunto das suas respostas, e as dimensões mostram como cada parte contribuiu.`,
  );

  const ordenadas = [...e.dimensoes].sort((a, b) => b.nota - a.nota);
  const maior = ordenadas[0];
  const menor = ordenadas[ordenadas.length - 1];
  if (maior && menor) {
    partes.push(
      maior.nota === menor.nota
        ? "As dimensões ficaram todas no mesmo nível."
        : `${maior.nome} é a dimensão mais alta (${maior.nota}%) e ${menor.nome} é a mais baixa (${menor.nota}%).`,
    );
  }

  const significados = DIMENSION_ORDER.map((id, i) =>
    i === 0 ? `${DIMENSION_INFO[id].nome} indica ${DIMENSION_INFO[id].significado}` : `${DIMENSION_INFO[id].nome}, ${DIMENSION_INFO[id].significado}`,
  );
  partes.push(`Cada dimensão mostra um lado do perfil: ${significados.join("; ")}.`);

  if (e.alertas.length === 0) {
    partes.push("As suas respostas parecem coerentes entre si, sem pontos de atenção.");
  } else {
    partes.push("Há pontos que merecem uma segunda olhada, mas eles são apenas informativos e não mudam o seu perfil.");
    for (const a of e.alertas.slice(0, 3)) partes.push(`Sobre "${a.nome}", ${a.reflexao}`);
  }

  if (e.evolucao) {
    const mudancas = e.evolucao.variacoes.filter((v) => v.sentido !== "estavel");
    if (mudancas.length === 0) {
      partes.push("Em relação à análise anterior, nenhuma dimensão mudou de forma relevante.");
    } else {
      partes.push(
        `Em relação à análise anterior, ${mudancas.map((v) => `${v.nome} ${v.sentido} ${Math.abs(v.delta)} pontos percentuais`).join("; ")}.`,
      );
    }
    partes.push(e.evolucao.mudouPerfil ? `O perfil mudou de ${e.evolucao.anterior.perfil} para ${e.perfil}.` : `O perfil continua ${e.perfil}.`);
  }

  partes.push("Este texto é educacional e apenas explica os números calculados pelo sistema; ele não altera o seu perfil.");
  return partes.join(" ");
}

/* --------------------------- Cache e serviço --------------------------- */

export interface LeituraCache {
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

/** Memória do processo + tabela economic_insights (chave 'dim|...'). Falha de cache nunca propaga. */
export function createLeituraCache(
  now: () => Date = () => new Date(),
  dbOps: Pick<typeof db, "getEconomicInsightRow" | "saveEconomicInsightRow"> = db,
): LeituraCache {
  const memory = new Map<string, { text: string; createdAt: string }>();
  const warn = (err: unknown) => {
    if (err instanceof Error && err.name === "DatabaseDisabledError") return;
    console.warn("[Dimensões] cache em banco indisponível; usando memória", err instanceof Error ? err.message : err);
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
        await withTimeout(dbOps.saveEconomicInsightRow(key, { kind: "dimensoes", reading: text }));
      } catch (err) {
        warn(err);
      }
    },
  };
}

/** Chave do cache: os mesmos números => o mesmo texto. Só guarda um hash (nenhum dado pessoal). */
export function leituraCacheKey(e: EntradaLeitura): string {
  const digest = createHash("sha256")
    .update(
      JSON.stringify({
        v: LEITURA_VERSAO,
        perfil: e.perfil,
        pontuacao: e.pontuacao,
        notas: e.dimensoes.map((d) => [d.id, d.nota]),
        alertas: e.alertas.map((a) => a.id),
        evolucao: e.evolucao
          ? { perfil: e.evolucao.anterior.perfil, pontuacao: e.evolucao.anterior.pontuacao, variacoes: e.evolucao.variacoes.map((v) => [v.id, v.de, v.para]) }
          : null,
      }),
    )
    .digest("hex")
    .slice(0, 32);
  return `dim|v${LEITURA_VERSAO}|${digest}`;
}

export interface LeituraDeps {
  generate?: (prompt: string) => Promise<unknown>;
  cache?: LeituraCache;
  now?: () => Date;
  hasKey?: () => boolean;
}

export function createLeituraService(deps: LeituraDeps = {}) {
  const generate = deps.generate ?? generateJson;
  const now = deps.now ?? (() => new Date());
  const hasKey = deps.hasKey ?? (() => !!process.env.GEMINI_API_KEY);
  const pending = new Map<string, Promise<LeituraOutcome>>();
  let lastFailureAt = Number.NEGATIVE_INFINITY;
  let defaultCache: LeituraCache | null = null;
  const getCache = () => deps.cache ?? (defaultCache ??= createLeituraCache(now));

  function fallback(e: EntradaLeitura, reason: string): LeituraOutcome {
    console.warn("[IA] leitura do perfil multidimensional: usando texto local", { reason });
    return { text: leituraLocal(e), source: "fallback", fallbackReason: reason };
  }

  async function generateFresh(key: string, e: EntradaLeitura): Promise<LeituraOutcome> {
    const at = now().getTime();
    try {
      const text = parseLeitura(await generate(buildLeituraPrompt(e)));
      const motivos = checarLeitura(text, e);
      if (motivos.length > 0) throw new Error(`Texto da IA reprovado na verificação: ${motivos.join("; ")}`);
      await getCache().save(key, text).catch((err) => console.warn("[Dimensões] não foi possível guardar a leitura", err));
      return { text, source: "gemini" };
    } catch (err) {
      lastFailureAt = at;
      return fallback(e, err instanceof Error ? err.message : "erro desconhecido");
    }
  }

  return {
    /** Nunca lança: qualquer problema com a IA vira o texto local. */
    async get(e: EntradaLeitura): Promise<LeituraOutcome> {
      const key = leituraCacheKey(e);

      const cached = await getCache().load(key).catch(() => null);
      if (cached && now().getTime() - Date.parse(cached.createdAt) < LEITURA_TTL_MS && checarLeitura(cached.text, e).length === 0) {
        return { text: cached.text, source: "gemini" };
      }

      if (!hasKey()) return fallback(e, "GEMINI_API_KEY não configurada");
      if (now().getTime() - lastFailureAt < AI_FAILURE_BACKOFF_MS) return fallback(e, "IA indisponível há pouco; nova tentativa em instantes");

      let p = pending.get(key);
      if (!p) {
        p = generateFresh(key, e).finally(() => pending.delete(key));
        pending.set(key, p);
      }
      return p;
    },
  };
}

let defaultService: ReturnType<typeof createLeituraService> | null = null;

export function getLeituraDoPerfil(e: EntradaLeitura): Promise<LeituraOutcome> {
  defaultService ??= createLeituraService();
  return defaultService.get(e);
}
