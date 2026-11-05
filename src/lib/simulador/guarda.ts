/**
 * Verificação do texto da IA antes de ele aparecer na simulação.
 * Descarta promessa/certeza de ganho, linguagem de recomendação, ativos específicos e qualquer número
 * (R$, %, anos/meses) diferente dos que o sistema calculou. Descartado → entra o texto local.
 *
 * Os valores em R$ são lidos no formato pt-BR (milhar com ponto, decimal com vírgula): o verificador do
 * painel econômico não serve aqui porque leria "R$ 1.234,56" como 1,234.
 */
import type { Profile } from "../suitability/scoring.ts";
import { checkForbiddenLanguage, checkProfileMention } from "../economia/content-guard.ts";
import { RATE_RULES, SCENARIOS } from "./premissas.ts";
import { riskySharePercent, type ClassPercent, type Projection } from "./projecao.ts";

export const MAX_SIM_TEXT_LENGTH = 1500;

const L = "\\p{L}\\p{N}";
const word = (alternatives: string) => new RegExp(`(?<![${L}])(?:${alternatives})(?![${L}])`, "iu");

/** Futuro do indicativo e certezas que soam como promessa ("você vai ter", "chegará a"). */
const CERTAINTY: [RegExp, string][] = [
  [word("vai (?:ter|chegar|alcançar|acumular|conseguir|obter|ganhar|atingir)|vão (?:ter|chegar|alcançar)"), "promessa de ganho"],
  [word("terá|terão|chegará|alcançará|acumulará|conseguirá|obterá|ganhará|atingirá|sem dúvida|com certeza"), "promessa de ganho"],
  // "o valor será…", "o rendimento será de 12%": a simulação só admite o condicional ("seria").
  [word("será|serão"), "promessa de ganho (linguagem de certeza)"],
];

export interface GuardInput {
  projection: Projection;
  allocation: ClassPercent[];
  profile: Profile;
}

export interface AllowedNumbers {
  percents: number[];
  money: number[];
  /** Números que podem acompanhar "anos" ou "meses". */
  times: number[];
}

export function allowedNumbers(g: GuardInput): AllowedNumbers {
  const p = g.projection;
  const percents: number[] = [100, p.rates.cdi, p.rates.ipca12m, riskySharePercent(g.allocation)];
  for (const a of g.allocation) percents.push(a.percent);
  for (const rule of Object.values(RATE_RULES)) {
    for (const s of SCENARIOS) percents.push(Math.abs(rule.kind === "cdi" ? rule.percentOfCdi[s] : rule.premium[s]));
  }

  const money: number[] = [p.input.initial, p.input.monthly, p.invested, p.inflationValue];
  if (p.input.goal !== null) money.push(p.input.goal);
  // 12: "inflação acumulada em 12 meses" (o IPCA do painel) e a conversão de ano em meses.
  const times: number[] = [p.input.years, p.months, 12];

  for (const s of SCENARIOS) {
    const r = p.scenarios[s];
    percents.push(...Object.values(r.classRates).map(Math.abs));
    money.push(r.finalValue, Math.abs(r.earnings), r.realValue, Math.abs(r.vsInflation));
    if (r.goal) {
      money.push(r.goal.shortfall);
      if (r.goal.month !== null) times.push(r.goal.month, Math.floor(r.goal.month / 12), r.goal.month % 12);
    }
  }
  money.push(Math.abs(p.scenarios.otimista.finalValue - p.scenarios.pessimista.finalValue));
  return { percents, money, times };
}

const near = (a: number, b: number, tol = 0.005) => Math.abs(a - b) <= tol;

function percentAllowed(n: number, allowed: number[]): boolean {
  return allowed.some((v) => [0, 1, 2].some((d) => near(Math.round(Math.abs(v) * 10 ** d) / 10 ** d, n, 1e-9)));
}

/** Valor em reais aceito se bater com um valor calculado (centavos) ou com ele arredondado para reais inteiros. */
function moneyAllowed(n: number, allowed: number[]): boolean {
  return allowed.some((v) => near(Math.abs(v), n) || near(Math.round(Math.abs(v)), n));
}

const MULTIPLIER: Record<string, number> = {
  mil: 1e3,
  milhão: 1e6,
  milhao: 1e6,
  milhões: 1e6,
  milhoes: 1e6,
  bilhão: 1e9,
  bilhao: 1e9,
  bilhões: 1e9,
  bilhoes: 1e9,
};

const MONEY = new RegExp(
  `R\\$\\s*(\\d{1,3}(?:\\.\\d{3})+|\\d+)(?:,(\\d+))?(?:\\s+(mil|milhão|milhao|milhões|milhoes|bilhão|bilhao|bilhões|bilhoes)(?![${L}]))?`,
  "giu",
);
const PERCENT = /(\d+(?:[.,]\d+)?)\s*(?:%|por cento)/giu;
const TIME = new RegExp(`(?<![${L}.,])(\\d+(?:,\\d+)?)\\s*(?:anos?|meses|mês)(?![${L}])`, "giu");

/** Motivos pelos quais o texto não pode ser exibido (lista vazia = texto aceito). */
export function checkSimText(text: string, g: GuardInput): string[] {
  const reasons = new Set<string>();
  const trimmed = text.trim();
  if (trimmed.length === 0) return ["texto vazio"];
  if (trimmed.length > MAX_SIM_TEXT_LENGTH) reasons.add("texto longo demais");

  for (const r of checkForbiddenLanguage(text)) reasons.add(r);
  for (const [re, reason] of CERTAINTY) if (re.test(text)) reasons.add(reason);
  for (const r of checkProfileMention(text, g.profile)) reasons.add(r);

  const allowed = allowedNumbers(g);

  for (const m of text.matchAll(MONEY)) {
    const whole = m[1]!.replace(/\./g, "");
    const value = Number(`${whole}${m[2] ? `.${m[2]}` : ""}`) * (m[3] ? MULTIPLIER[m[3].toLowerCase()]! : 1);
    if (!moneyAllowed(value, allowed.money)) reasons.add(`valor em R$ que o sistema não calculou (${m[0].trim()})`);
  }
  // Remove os trechos de R$ antes de ler percentuais, para "R$ 1.234,56" não ser lido como outro número.
  const withoutMoney = text.replace(MONEY, " ");
  for (const m of withoutMoney.matchAll(PERCENT)) {
    const n = Number(m[1]!.replace(",", "."));
    if (!percentAllowed(n, allowed.percents)) reasons.add(`percentual que o sistema não forneceu (${m[0].trim()})`);
  }
  for (const m of withoutMoney.matchAll(TIME)) {
    const n = Number(m[1]!.replace(",", "."));
    if (!allowed.times.some((t) => near(t, n, 1e-9))) reasons.add(`prazo que o sistema não forneceu (${m[0].trim()})`);
  }
  return [...reasons];
}
