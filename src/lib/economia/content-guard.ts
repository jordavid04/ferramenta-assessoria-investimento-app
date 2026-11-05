/**
 * Verificação do texto da IA antes de ele aparecer na tela.
 * Se qualquer regra for violada o texto é descartado e entra a versão local (modo offline).
 */
import { BASE_ALLOCATION, type AssetClass } from "../ai/allocation.ts";
import type { Profile } from "../suitability/scoring.ts";
import type { ScenarioFacts } from "./scenario.ts";

export interface EconomicInsight {
  reading: string;
  classNotes: { assetClass: AssetClass; note: string }[];
}

export const ASSET_CLASSES: AssetClass[] = ["Renda Fixa", "Fundos Imobiliários", "Ações", "ETFs", "Fundos"];

export const MAX_READING_LENGTH = 900;
export const MAX_NOTE_LENGTH = 300;
export const MAX_CLASS_NOTES = 5;

export interface GuardContext {
  /** Perfil da conta, ou null na leitura geral. */
  profile: Profile | null;
  /** Números que o sistema forneceu (a IA só pode citar estes em %/R$). */
  allowedNumbers: number[];
}

export interface GuardResult {
  ok: boolean;
  reasons: string[];
}

const L = "\\p{L}\\p{N}";
/** Palavra inteira (\b do JS não entende acentos). */
const word = (alternatives: string) => new RegExp(`(?<![${L}])(?:${alternatives})(?![${L}])`, "iu");

const PROMISE: [RegExp, string][] = [
  [word("garant\\p{L}*|certeza|sem risco|risco zero|dinheiro fácil|enriquec\\p{L}*"), "promessa de ganho"],
  [word("(?:lucro|ganho|retorno|resultado)s? (?:certo|garantido|assegurado)s?"), "promessa de ganho"],
  [word("vai(?:o)? (?:render|valorizar|subir|dobrar|disparar|multiplicar)"), "promessa de ganho"],
  [
    // verbo/substantivo de ganho com o percentual como o próprio ganho ("rende 15%", "rentabilidade de 12%",
    // "ganho de até 10%"). "ganhos acima da inflação de 4,58%" não entra: ali o número é a inflação.
    new RegExp(
      `(?<![${L}])(?:rende|rendem|render|rendeu|rendimentos?|rentabilidade|rentabilizar|retornos?|ganhos?|ganhar|lucros?|lucrar)\\s+(?:(?:de|em|a|cerca de|até|em torno de|aproximadamente|mais de|superior a|igual a)\\s+){0,2}(?:R\\$\\s*)?\\d+(?:[.,]\\d+)?\\s*(?:%|por cento)`,
      "iu",
    ),
    "promessa de ganho",
  ],
];

const RECOMMENDATION: [RegExp, string][] = [
  [word("compre|comprem|comprar|vender|venda|vendam|invista|invistam|aplique|apliquem|aproveite|aproveitem"), "linguagem de compra/venda"],
  [word("recomend\\p{L}*|sugiro|sugerimos|aconselh\\p{L}*|indico|indicamos"), "linguagem de recomendação"],
  [word("você deve|voce deve|deveria|o ideal é|o melhor é|melhor momento|hora de (?:comprar|vender|investir|entrar|sair)"), "linguagem de recomendação individual"],
];

/** Códigos de negociação (PETR4, HGLG11, BOVA11…): a regra do projeto é não citar ativos específicos. */
const TICKER = new RegExp(`(?<![${L}])[A-Z]{4}\\d{1,2}(?![${L}])`, "u");
const MARKUP = /[<>]|https?:\/\/|```|\*\*/;
/** Só conta como menção a perfil quando vem após "perfil"/"investidor" ("inflação moderada" não é o perfil Moderado). */
const PROFILE_MENTION = new RegExp(
  `(?<![${L}])(?:perfil|perfis|investidor|investidora|investidores)\\s+(?:(?:mais|menos|muito)\\s+)?(conservador|moderado|arrojado|agressivo)(?![${L}])`,
  "giu",
);
const NUMBER = /(R\$\s*)?(\d+(?:[.,]\d+)?)(\s*(?:%|por cento))?/giu;

function matchesAllowed(n: number, allowed: number[]): boolean {
  return allowed.some((v) => [0, 1, 2].some((d) => Math.abs(Math.round(Math.abs(v) * 10 ** d) / 10 ** d - n) < 1e-9));
}

/** Regras de linguagem (promessa, recomendação, ativo específico, formatação), sem olhar números nem perfil. */
export function checkForbiddenLanguage(text: string): string[] {
  const reasons = new Set<string>();
  for (const [re, reason] of [...PROMISE, ...RECOMMENDATION]) if (re.test(text)) reasons.add(reason);
  if (TICKER.test(text)) reasons.add("citação de ativo específico (código de negociação)");
  if (MARKUP.test(text)) reasons.add("formatação ou link não permitido");
  return [...reasons];
}

/** Motivo quando o texto cita um perfil diferente de `profile` (vazio = tudo certo). */
export function checkProfileMention(text: string, profile: Profile | null): string[] {
  if (!profile) return [];
  for (const m of text.matchAll(PROFILE_MENTION)) {
    if (m[1].toLowerCase() !== profile.toLowerCase()) return ["menção a perfil diferente do perfil da conta"];
  }
  return [];
}

/** Motivos pelos quais o texto não pode ser exibido (lista vazia = texto aceito). */
export function checkInsightText(text: string, ctx: GuardContext): string[] {
  const reasons = new Set<string>(checkForbiddenLanguage(text));

  for (const m of text.matchAll(NUMBER)) {
    if (!m[1] && !m[3]) continue; // só confere valores em % ou R$
    const n = Number(m[2].replace(",", "."));
    if (!matchesAllowed(n, ctx.allowedNumbers)) reasons.add(`número que o sistema não forneceu (${m[0].trim()})`);
  }

  for (const r of checkProfileMention(text, ctx.profile)) reasons.add(r);
  return [...reasons];
}

export function checkInsight(insight: EconomicInsight, ctx: GuardContext): GuardResult {
  const reasons = new Set<string>();
  if (insight.reading.length > MAX_READING_LENGTH) reasons.add("leitura longa demais");
  if (insight.classNotes.length === 0 || insight.classNotes.length > MAX_CLASS_NOTES) reasons.add("quantidade de classes fora do esperado");
  for (const r of checkInsightText(insight.reading, ctx)) reasons.add(r);
  for (const n of insight.classNotes) {
    if (!ASSET_CLASSES.includes(n.assetClass)) reasons.add("classe de ativo desconhecida");
    if (n.note.length > MAX_NOTE_LENGTH) reasons.add("nota longa demais");
    for (const r of checkInsightText(n.note, ctx)) reasons.add(r);
  }
  return { ok: reasons.size === 0, reasons: [...reasons] };
}

/** Números que o sistema entregou à IA: indicadores do cenário + percentuais da alocação-base do perfil. */
export function allowedNumbersFor(facts: ScenarioFacts, profile: Profile | null): number[] {
  const nums = [facts.selic, facts.cdi, facts.ipca12m, facts.realRate].filter((n): n is number => n !== null);
  if (profile) for (const a of BASE_ALLOCATION[profile]) nums.push(a.percent);
  return nums;
}
